import {
  finalCloseCodes,
  realtimeCloseCodes,
  realtimePath,
  realtimeProtocolVersion,
  type CharacterAppearance,
  type ClientMessage,
  type PlayerPose,
  type RoomOccupancy,
  type ServerMessage,
  type WelcomeMessage,
} from "@nightpaws/shared";

export interface JoinIdentity {
  name: string;
  look: CharacterAppearance;
  playerId: string | null;
}

export type ConnectionPhase = "idle" | "connecting" | "queued" | "live" | "retrying" | "stopped";

export type JoinOutcome = "live" | "queued" | "offline" | "stopped";

export interface RoomConnectionListener {
  onPhase(phase: ConnectionPhase): void;
  onWelcome(welcome: WelcomeMessage): void;
  onQueued(position: number, occupancy: RoomOccupancy): void;
  onMessage(message: ServerMessage): void;
  onStopped(reason: string): void;
}

const flushIntervalMs = 100;
const heartbeatIntervalMs = 15000;
const maxRetryDelayMs = 15000;

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${realtimePath}`;
}

function poseChanged(next: PlayerPose, previous: PlayerPose | null): boolean {
  if (!previous) return true;
  return (
    Math.abs(next.x - previous.x) > 0.01 ||
    Math.abs(next.z - previous.z) > 0.01 ||
    Math.abs(next.f - previous.f) > 0.02 ||
    next.d !== previous.d
  );
}

export class RoomConnection {
  private socket: WebSocket | null = null;
  private identity: JoinIdentity | null = null;
  private phaseValue: ConnectionPhase = "idle";
  private attempts = 0;
  private retryTimer: number | null = null;
  private flushTimer: number | null = null;
  private sentPose: PlayerPose | null = null;
  private lastSentAt = 0;
  private selfId: string | null = null;
  private lastError: string | null = null;
  private stopped = true;
  private pendingJoin: ((outcome: JoinOutcome) => void) | null = null;
  private resumeStorageKey: string;

  constructor(
    private roomId: string,
    private readonly listener: RoomConnectionListener,
    private readonly poseSource: () => PlayerPose | null,
  ) {
    this.resumeStorageKey = `nightpaws.resume.${roomId}`;
  }

  get phase(): ConnectionPhase {
    return this.phaseValue;
  }

  get you(): string | null {
    return this.selfId;
  }

  join(identity: JoinIdentity): Promise<JoinOutcome> {
    this.identity = identity;
    this.stopped = false;
    this.lastError = null;
    if (this.phaseValue === "live" || this.phaseValue === "queued") {
      this.send({ t: "look", name: identity.name, look: identity.look });
      return Promise.resolve(this.phaseValue);
    }
    return new Promise((resolve) => {
      this.settleJoin("offline");
      this.pendingJoin = resolve;
      if (!this.socket) this.open();
    });
  }

  updateIdentity(identity: JoinIdentity): void {
    this.identity = identity;
    if (this.phaseValue === "live" || this.phaseValue === "queued") this.send({ t: "look", name: identity.name, look: identity.look });
  }

  switchRoom(roomId: string): void {
    if (roomId === this.roomId) return;
    if (this.phaseValue !== "idle") this.leave();
    this.roomId = roomId;
    this.resumeStorageKey = `nightpaws.resume.${roomId}`;
  }

  jump(): void {
    if (this.phaseValue === "live") this.send({ t: "jump" });
  }

  leave(): void {
    this.stopped = true;
    this.clearRetry();
    this.forgetResume();
    this.send({ t: "leave" });
    this.socket?.close(realtimeCloseCodes.normal);
    this.socket = null;
    this.stopFlushing();
    this.selfId = null;
    this.setPhase("idle");
    this.settleJoin("stopped");
  }

  private open(): void {
    this.clearRetry();
    this.setPhase(this.attempts ? "retrying" : "connecting");
    const socket = new WebSocket(socketUrl());
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket || !this.identity) return;
      const resume = this.readResume();
      this.send({
        t: "hello",
        v: realtimeProtocolVersion,
        room: this.roomId,
        name: this.identity.name,
        look: this.identity.look,
        ...(this.identity.playerId ? { playerId: this.identity.playerId } : {}),
        ...(resume ? { resume } : {}),
      });
      this.startFlushing();
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket || typeof event.data !== "string") return;
      try {
        this.receive(JSON.parse(event.data) as ServerMessage);
      } catch {
        return;
      }
    };
    socket.onclose = (event) => {
      if (this.socket === socket) this.closed(event);
    };
  }

  private receive(message: ServerMessage): void {
    switch (message.t) {
      case "welcome":
        this.attempts = 0;
        this.selfId = message.you;
        this.sentPose = null;
        this.storeResume(message.resume);
        this.setPhase("live");
        this.listener.onWelcome(message);
        this.settleJoin("live");
        return;
      case "queued":
        this.attempts = 0;
        this.setPhase("queued");
        this.listener.onQueued(message.position, message.occupancy);
        this.settleJoin("queued");
        return;
      case "error":
        this.lastError = message.message;
        if (message.code === "queue_full" || message.code === "unavailable") this.forgetResume();
        this.listener.onMessage(message);
        return;
      default:
        this.listener.onMessage(message);
    }
  }

  private closed(event: CloseEvent): void {
    this.socket = null;
    this.stopFlushing();
    this.selfId = null;
    if (this.stopped) return;
    if (finalCloseCodes.has(event.code)) {
      this.stopped = true;
      this.forgetResume();
      this.setPhase("stopped");
      const reason = this.lastError ?? (event.reason || "The club closed the connection.");
      this.listener.onStopped(reason);
      this.settleJoin("stopped");
      return;
    }
    const base = Math.min(maxRetryDelayMs, 500 * 2 ** this.attempts);
    const delay = Math.max(event.code === realtimeCloseCodes.queueFull ? 10000 : 0, base * (0.75 + Math.random() * 0.5));
    this.attempts += 1;
    this.setPhase("retrying");
    this.settleJoin("offline");
    this.retryTimer = window.setTimeout(() => this.open(), delay);
  }

  private flush(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (this.phaseValue === "live") {
      const pose = this.poseSource();
      if (pose && poseChanged(pose, this.sentPose)) {
        this.send({ t: "pose", ...pose });
        this.sentPose = pose;
        this.lastSentAt = now;
        return;
      }
    }
    if (now - this.lastSentAt > heartbeatIntervalMs) {
      this.send({ t: "hb" });
      this.lastSentAt = now;
    }
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private setPhase(phase: ConnectionPhase): void {
    if (this.phaseValue === phase) return;
    this.phaseValue = phase;
    this.listener.onPhase(phase);
  }

  private settleJoin(outcome: JoinOutcome): void {
    const resolve = this.pendingJoin;
    this.pendingJoin = null;
    resolve?.(outcome);
  }

  private startFlushing(): void {
    this.stopFlushing();
    this.lastSentAt = performance.now();
    this.flushTimer = window.setInterval(() => this.flush(), flushIntervalMs);
  }

  private stopFlushing(): void {
    if (this.flushTimer !== null) window.clearInterval(this.flushTimer);
    this.flushTimer = null;
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private readResume(): string | null {
    try {
      return sessionStorage.getItem(this.resumeStorageKey);
    } catch {
      return null;
    }
  }

  private storeResume(token: string): void {
    try {
      sessionStorage.setItem(this.resumeStorageKey, token);
    } catch {
      return;
    }
  }

  private forgetResume(): void {
    try {
      sessionStorage.removeItem(this.resumeStorageKey);
    } catch {
      return;
    }
  }
}
