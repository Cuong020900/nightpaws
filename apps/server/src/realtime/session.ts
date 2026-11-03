import { randomBytes } from "node:crypto";
import type { CharacterAppearance, ServerMessage, WarningCode } from "@nightpaws/shared";
import { WebSocket } from "ws";
import { DecayingCounter, TokenBucket } from "../security/token-bucket.ts";

export type SessionStatus = "handshake" | "joining" | "queued" | "live" | "closed";

export interface SessionLimits {
  messagesPerSecond: number;
  messageBurst: number;
  posesPerSecond: number;
  violationsBeforeKick: number;
  maxBufferedBytes: number;
}

const warningIntervalMs = 1000;

export function newSessionId(): string {
  return randomBytes(9).toString("base64url");
}

export function newResumeToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(18).toString("base64url")}`;
}

export class Session {
  id = newSessionId();
  status: SessionStatus = "handshake";
  roomId: string | null = null;
  name = "";
  look: CharacterAppearance = { characterTypeId: "", outfitId: "" };
  playerId: string | null = null;
  resumeToken = "";
  leaving = false;
  replaced = false;
  alive = true;
  needsSnapshot = false;
  lastInboundAt = Date.now();
  lastQueuePosition = 0;
  readonly connectedAt = Date.now();
  readonly messages: TokenBucket;
  readonly poses: TokenBucket;
  readonly jumps = new TokenBucket(3, 4);
  readonly looks = new TokenBucket(0.5, 3);
  readonly heartbeats = new TokenBucket(1, 5);
  private readonly violations = new DecayingCounter(10000);
  private lastWarningAt = 0;
  private readonly softBufferedBytes: number;

  constructor(
    readonly socket: WebSocket,
    readonly ip: string,
    private readonly limits: SessionLimits,
  ) {
    this.messages = new TokenBucket(limits.messagesPerSecond, limits.messageBurst);
    this.poses = new TokenBucket(limits.posesPerSecond, limits.posesPerSecond * 2);
    this.softBufferedBytes = Math.floor(limits.maxBufferedBytes / 4);
  }

  get isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN && this.status !== "closed";
  }

  get canTakeDroppable(): boolean {
    return this.isOpen && this.socket.bufferedAmount <= this.softBufferedBytes;
  }

  send(message: ServerMessage | string, droppable = false): boolean {
    if (!this.isOpen) return false;
    if (this.socket.bufferedAmount > this.limits.maxBufferedBytes) {
      this.socket.terminate();
      return false;
    }
    if (droppable && this.socket.bufferedAmount > this.softBufferedBytes) {
      this.needsSnapshot = true;
      return false;
    }
    this.socket.send(typeof message === "string" ? message : JSON.stringify(message));
    return true;
  }

  warn(code: WarningCode, message: string): void {
    const now = Date.now();
    if (now - this.lastWarningAt < warningIntervalMs) return;
    this.lastWarningAt = now;
    this.send({ t: "warn", code, message });
  }

  recordViolation(weight: number): boolean {
    return this.violations.add(weight) >= this.limits.violationsBeforeKick;
  }

  close(code: number, reason: string): void {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close(code, reason.slice(0, 120));
      setTimeout(() => this.socket.terminate(), 2000).unref();
    }
  }
}
