import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { realtimeCloseCodes, realtimePath, type ClientMessage, type RejectionCode, type WarningCode } from "@nightpaws/shared";
import type { FastifyBaseLogger } from "fastify";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type { ServerConfig } from "../config.ts";
import type { AbuseGuard } from "../security/abuse-guard.ts";
import { clientAddress, type TrustProxy } from "../security/client-address.ts";
import { parseClientMessage } from "./client-messages.ts";
import type { RoomDirectory } from "./room-directory.ts";
import { Session } from "./session.ts";

export interface GatewayOptions {
  server: Server;
  directory: RoomDirectory;
  guard: AbuseGuard;
  trust: TrustProxy;
  allowedOrigins: string[];
  limits: ServerConfig["realtime"];
  log: FastifyBaseLogger;
}

const statusText: Record<number, string> = {
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  503: "Service Unavailable",
};

function rejectUpgrade(socket: Duplex, status: number, retryAfterSeconds?: number): void {
  const text = statusText[status] ?? "Bad Request";
  if (socket.writable) {
    const retry = retryAfterSeconds ? `Retry-After: ${retryAfterSeconds}\r\n` : "";
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${text.length}\r\n${retry}\r\n${text}`);
  }
  socket.destroy();
}

export class RealtimeGateway {
  private readonly wss: WebSocketServer;
  private readonly sessions = new Set<Session>();
  private readonly allowedOrigins: Set<string>;
  private heartbeat: NodeJS.Timeout | null = null;
  private accepting = true;
  private rejectedUpgrades = 0;

  constructor(private readonly options: GatewayOptions) {
    this.allowedOrigins = new Set(options.allowedOrigins.map((origin) => origin.toLowerCase()));
    this.wss = new WebSocketServer({
      noServer: true,
      clientTracking: false,
      perMessageDeflate: false,
      maxPayload: options.limits.maxPayloadBytes,
    });
    options.server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.upgrade(request, socket, head).catch((error: unknown) => {
        options.log.error({ err: error }, "websocket upgrade failed");
        rejectUpgrade(socket, 503, 5);
      });
    });
  }

  get stats(): { sessions: number; connections: number; rejectedUpgrades: number } {
    return { sessions: this.sessions.size, connections: this.options.guard.openConnections, rejectedUpgrades: this.rejectedUpgrades };
  }

  start(): void {
    this.heartbeat = setInterval(() => this.checkLiveness(), this.options.limits.heartbeatMs);
  }

  async close(): Promise<void> {
    this.accepting = false;
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const session of this.sessions) session.close(realtimeCloseCodes.goingAway, "Server restarting");
    const deadline = Date.now() + 3000;
    while (this.sessions.size && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    for (const session of this.sessions) session.socket.terminate();
  }

  private originAllowed(origin: string | undefined): boolean {
    if (!this.allowedOrigins.size) return true;
    return origin !== undefined && this.allowedOrigins.has(origin.toLowerCase());
  }

  private async upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    socket.on("error", () => socket.destroy());
    const { guard, log, trust } = this.options;
    const pathname = (request.url ?? "").split("?")[0];
    if (pathname !== realtimePath) return rejectUpgrade(socket, 404);
    if (!this.accepting) return rejectUpgrade(socket, 503, 5);
    if (!this.originAllowed(request.headers.origin)) {
      this.rejectedUpgrades += 1;
      return rejectUpgrade(socket, 403);
    }

    const ip = clientAddress(request, trust);
    if (await guard.isBanned(ip)) {
      this.rejectedUpgrades += 1;
      return rejectUpgrade(socket, 403);
    }
    const opened = guard.tryOpen(ip);
    if (opened !== "ok") {
      this.rejectedUpgrades += 1;
      log.warn({ ip, reason: opened }, "websocket connection refused");
      return rejectUpgrade(socket, opened === "ip-limit" ? 429 : 503, 10);
    }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      guard.release(ip);
    };
    socket.once("close", release);
    if (!(await guard.allowConnectAttempt(ip))) {
      this.rejectedUpgrades += 1;
      log.warn({ ip }, "websocket connection rate exceeded");
      return rejectUpgrade(socket, 429, 30);
    }
    if (socket.destroyed) return release();
    this.wss.handleUpgrade(request, socket, head, (ws) => this.accept(ws, ip));
  }

  private accept(ws: WebSocket, ip: string): void {
    const { limits, log, directory } = this.options;
    const session = new Session(ws, ip, limits);
    this.sessions.add(session);
    const handshakeTimer = setTimeout(() => {
      if (session.status === "handshake") session.close(realtimeCloseCodes.handshakeTimeout, "Handshake timeout");
    }, limits.handshakeTimeoutMs);

    ws.on("pong", () => {
      session.alive = true;
    });
    ws.on("message", (data: RawData, isBinary: boolean) => this.receive(session, data, isBinary));
    ws.on("error", (error: Error & { code?: string }) => {
      if (error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH") {
        log.warn({ ip, session: session.id }, "oversized websocket message");
        void this.options.guard.strike(ip, "oversized message");
      }
    });
    ws.on("close", () => {
      clearTimeout(handshakeTimer);
      this.sessions.delete(session);
      const hub = session.roomId ? directory.get(session.roomId) : undefined;
      if (hub) hub.disconnect(session);
      else session.status = "closed";
    });
  }

  private receive(session: Session, data: RawData, isBinary: boolean): void {
    if (session.status === "closed" || session.leaving) return;
    session.lastInboundAt = Date.now();
    if (!session.messages.take()) {
      this.violation(session, 1, "message flood", "rate_limited");
      return;
    }
    const message = parseClientMessage(data, isBinary);
    if (!message) {
      this.violation(session, 5, "invalid message", "invalid_message");
      return;
    }
    if (session.status === "handshake") {
      this.handshake(session, message);
      return;
    }
    const hub = session.roomId ? this.options.directory.get(session.roomId) : undefined;
    if (!hub) return;
    switch (message.t) {
      case "hello":
        this.violation(session, 5, "repeated hello", "invalid_message");
        return;
      case "hb":
        if (!session.heartbeats.take()) this.violation(session, 1, "heartbeat flood", "rate_limited");
        return;
      case "leave":
        session.leaving = true;
        session.close(realtimeCloseCodes.normal, "Bye");
        return;
      case "look":
        if (!session.looks.take()) this.violation(session, 2, "look flood", "rate_limited");
        else hub.changeLook(session, message.name, message.look);
        return;
      case "pose":
        if (session.status !== "live") return;
        if (!session.poses.take()) this.violation(session, 1, "pose flood", "rate_limited");
        else hub.pose(session, message);
        return;
      case "jump":
        if (session.status !== "live") return;
        if (!session.jumps.take()) this.violation(session, 1, "jump flood", "rate_limited");
        else hub.jump(session);
    }
  }

  private handshake(session: Session, message: ClientMessage): void {
    if (message.t !== "hello") {
      this.refuse(session, "bad_hello", "Say hello first.", realtimeCloseCodes.badHello);
      return;
    }
    const hub = this.options.directory.get(message.room);
    if (!hub) {
      this.refuse(session, "unknown_room", "That room does not exist.", realtimeCloseCodes.unknownRoom);
      return;
    }
    session.status = "joining";
    session.roomId = hub.id;
    hub.join(session, message);
  }

  private refuse(session: Session, code: RejectionCode, message: string, closeCode: number): void {
    session.send({ t: "error", code, message });
    session.leaving = true;
    session.close(closeCode, message);
  }

  private violation(session: Session, weight: number, reason: string, code: WarningCode): void {
    session.warn(code, code === "rate_limited" ? "Slow down: messages are being dropped." : "That message was not understood.");
    if (!session.recordViolation(weight)) return;
    this.options.log.warn({ ip: session.ip, session: session.id, reason }, "kicking abusive websocket client");
    void this.options.guard.strike(session.ip, reason);
    this.refuse(session, "kicked", "Too many messages. You have been disconnected.", realtimeCloseCodes.kicked);
  }

  private checkLiveness(): void {
    const now = Date.now();
    for (const session of this.sessions) {
      if (!session.alive) {
        session.socket.terminate();
        continue;
      }
      if (now - session.lastInboundAt > this.options.limits.idleTimeoutMs) {
        session.close(realtimeCloseCodes.idleTimeout, "Idle timeout");
        continue;
      }
      session.alive = false;
      if (session.socket.readyState === session.socket.OPEN) session.socket.ping();
    }
  }
}
