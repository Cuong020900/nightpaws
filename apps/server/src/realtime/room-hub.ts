import {
  realtimeCloseCodes,
  requireCharacterType,
  type CharacterAppearance,
  type HelloMessage,
  type PlayerDelta,
  type PlayerPose,
  type RoomMusicState,
  type RoomOccupancy,
  type RoomPlayer,
  type RoomSummary,
  type SceneDescriptor,
  type ServerMessage,
} from "@nightpaws/shared";
import type { FastifyBaseLogger } from "fastify";
import type { MusicService } from "../music/music-service.ts";
import type { BusEvent, RoomBus } from "./room-bus.ts";
import type { RoomMembership } from "./room-membership.ts";
import { newResumeToken, type Session } from "./session.ts";

export interface RoomHubSettings {
  tickMs: number;
  resumeGraceMs: number;
  leaseMs: number;
}

interface LivePlayer {
  session: Session;
  state: RoomPlayer;
  dirty: boolean;
  jumped: boolean;
  budget: number;
  budgetAt: number;
  lastCorrectionAt: number;
  trustNextPose: boolean;
}

interface RemotePlayer {
  player: RoomPlayer;
  origin: string;
}

const spawnZoneRadius = 3;
const movementBudgetCap = 2.5;
const speedAllowance = 1.5;
const correctionIntervalMs = 250;
const maintenanceMs = 1000;
const rosterMs = 3000;
const remoteOriginTimeoutMs = 10000;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return angle - turn * Math.floor((angle + Math.PI) / turn);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stamped(state: RoomMusicState): RoomMusicState {
  return { ...state, serverTime: new Date().toISOString() };
}

function toDelta(player: RoomPlayer, jumped: boolean): PlayerDelta {
  return [player.id, player.x, player.z, player.f, player.d, jumped ? 1 : 0];
}

export class RoomHub {
  readonly id: string;
  private readonly sessions = new Map<string, Session>();
  private readonly live = new Map<string, LivePlayer>();
  private readonly remote = new Map<string, RemotePlayer>();
  private readonly remoteOrigins = new Map<string, number>();
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly pending = new Set<Promise<unknown>>();
  private occupancy: RoomOccupancy;
  private announcedOccupancy = "";
  private musicState: RoomMusicState | null = null;
  private reconciling = false;
  private reconcileAgain = false;

  constructor(
    readonly descriptor: SceneDescriptor,
    private readonly membership: RoomMembership,
    private readonly bus: RoomBus,
    private readonly music: MusicService | null,
    private readonly settings: RoomHubSettings,
    private readonly log: FastifyBaseLogger,
  ) {
    this.id = descriptor.id;
    this.occupancy = { players: 0, capacity: membership.capacity, queued: 0 };
  }

  get summary(): RoomSummary {
    return { id: this.id, displayName: this.descriptor.displayName, ...this.occupancy };
  }

  get localSessions(): number {
    return this.sessions.size;
  }

  start(): void {
    this.timers.push(
      setInterval(() => this.tick(), this.settings.tickMs),
      setInterval(() => this.track(this.maintain()), maintenanceMs),
      setInterval(() => this.track(this.refreshLeases()), Math.floor(this.settings.leaseMs / 3)),
      setInterval(() => this.publishRoster(), rosterMs),
    );
    this.track(this.maintain());
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  async drain(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  join(session: Session, hello: HelloMessage): void {
    this.track(
      this.admitOrQueue(session, hello).catch((error: unknown) => {
        this.log.error({ err: error, session: session.id }, "could not admit player");
        session.send({ t: "error", code: "unavailable", message: "The club is having trouble letting people in. Retrying…" });
        session.close(realtimeCloseCodes.tryAgainLater, "Try again later");
      }),
    );
  }

  pose(session: Session, pose: PlayerPose): void {
    const player = this.live.get(session.id);
    if (!player || player.session !== session) return;
    const area = this.descriptor.walkableArea;
    let x = clamp(pose.x, area.minX, area.maxX);
    let z = clamp(pose.z, area.minZ, area.maxZ);
    const now = performance.now();
    const speed = requireCharacterType(player.state.look.characterTypeId).walkSpeed * speedAllowance;
    player.budget = Math.min(movementBudgetCap, player.budget + ((now - player.budgetAt) / 1000) * speed);
    player.budgetAt = now;
    const offsetX = x - player.state.x;
    const offsetZ = z - player.state.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const spawn = this.descriptor.spawn;
    let corrected = x !== pose.x || z !== pose.z;
    const trusted = player.trustNextPose;
    player.trustNextPose = false;
    if (!trusted && Math.hypot(x - spawn.x, z - spawn.z) > spawnZoneRadius) {
      if (distance <= player.budget) {
        player.budget -= distance;
      } else {
        const reach = player.budget / distance;
        x = player.state.x + offsetX * reach;
        z = player.state.z + offsetZ * reach;
        player.budget = 0;
        corrected = true;
      }
    }
    const dance = pose.d && requireCharacterType(player.state.look.characterTypeId).dances.includes(pose.d) ? pose.d : null;
    const next = { x: round(x), z: round(z), f: round(wrapAngle(pose.f)), d: dance };
    const state = player.state;
    if (next.x !== state.x || next.z !== state.z || next.f !== state.f || next.d !== state.d) {
      Object.assign(state, next);
      player.dirty = true;
    }
    if (corrected && now - player.lastCorrectionAt > correctionIntervalMs) {
      player.lastCorrectionAt = now;
      session.send({ t: "correct", x: state.x, z: state.z });
    }
  }

  jump(session: Session): void {
    const player = this.live.get(session.id);
    if (!player || player.session !== session) return;
    player.jumped = true;
    player.dirty = true;
  }

  changeLook(session: Session, name: string, look: CharacterAppearance): void {
    session.name = name;
    session.look = look;
    const player = this.live.get(session.id);
    if (!player || player.session !== session) return;
    player.state.name = name;
    player.state.look = look;
    const message: ServerMessage = { t: "look", id: session.id, name, look };
    this.broadcast(message, session);
    this.bus.publish(this.id, { k: "look", id: session.id, name, look });
  }

  disconnect(session: Session): void {
    this.track(this.release(session));
  }

  publishMusic(state: RoomMusicState): void {
    this.musicState = state;
    this.broadcast({ t: "music", state: stamped(state) });
    this.bus.publish(this.id, { k: "music", state });
  }

  receive(origin: string, event: BusEvent): void {
    this.remoteOrigins.set(origin, Date.now());
    switch (event.k) {
      case "join":
        this.remote.set(event.player.id, { player: event.player, origin });
        this.broadcast({ t: "join", player: event.player });
        return;
      case "leave":
        if (this.remote.delete(event.id)) this.broadcast({ t: "leave", id: event.id });
        return;
      case "look": {
        const known = this.remote.get(event.id);
        if (!known) return;
        known.player.name = event.name;
        known.player.look = event.look;
        this.broadcast({ t: "look", id: event.id, name: event.name, look: event.look });
        return;
      }
      case "tick": {
        const deltas = event.p.filter(([id]) => this.remote.has(id));
        for (const [id, x, z, f, d] of deltas) Object.assign(this.remote.get(id)!.player, { x, z, f, d });
        if (deltas.length) this.broadcastDroppable(JSON.stringify({ t: "tick", p: deltas }));
        return;
      }
      case "roster":
        this.applyRoster(origin, event.players);
        return;
      case "music":
        this.musicState = event.state;
        this.music?.noteRemoteState(event.state);
        this.broadcast({ t: "music", state: stamped(event.state) });
        return;
      case "queue":
        this.track(this.reconcileQueue());
    }
  }

  private track(work: Promise<unknown>): void {
    const tracked = work.catch((error: unknown) => this.log.error({ err: error }, "room task failed"));
    this.pending.add(tracked);
    void tracked.finally(() => this.pending.delete(tracked));
  }

  private async admitOrQueue(session: Session, hello: HelloMessage): Promise<void> {
    session.roomId = this.id;
    session.name = hello.name;
    session.look = hello.look;
    session.playerId = hello.playerId ?? null;

    let resumed = false;
    if (hello.resume) {
      const resumedId = hello.resume.split(".")[0]!;
      const existing = this.sessions.get(resumedId);
      if (existing && existing.resumeToken === hello.resume) {
        existing.replaced = true;
        this.sessions.delete(resumedId);
        if (this.live.get(resumedId)?.session === existing) this.live.delete(resumedId);
        existing.close(realtimeCloseCodes.replaced, "Session resumed elsewhere");
        resumed = existing.status === "live";
        session.id = resumedId;
        session.resumeToken = hello.resume;
        if (existing.status === "queued") {
          session.status = "queued";
          this.sessions.set(session.id, session);
          await this.reconcileQueue();
          return;
        }
      } else if (await this.membership.resume(resumedId, hello.resume)) {
        resumed = true;
        session.id = resumedId;
        session.resumeToken = hello.resume;
      }
    }

    if (!session.isOpen) {
      if (resumed) await this.membership.hold(session.id, session.resumeToken, this.settings.resumeGraceMs);
      return;
    }
    this.sessions.set(session.id, session);

    if (resumed) {
      this.admit(session, true);
      return;
    }

    const result = await this.membership.admit(session.id);
    if (!session.isOpen || this.sessions.get(session.id) !== session) {
      this.sessions.delete(session.id);
      await this.membership.leave(session.id);
      await this.promoteAndAdmit();
      return;
    }
    if (result.kind === "admitted") {
      this.admit(session, false);
      return;
    }
    if (result.kind === "queue-full") {
      this.sessions.delete(session.id);
      session.send({ t: "error", code: "queue_full", message: "The line outside is full. Try again in a bit." });
      session.close(realtimeCloseCodes.queueFull, "Queue full");
      return;
    }
    session.status = "queued";
    session.lastQueuePosition = result.position;
    this.occupancy = { ...this.occupancy, queued: Math.max(this.occupancy.queued, result.position) };
    session.send({ t: "queued", position: result.position, occupancy: this.occupancy });
    this.log.info({ session: session.id, ip: session.ip, position: result.position }, "player queued");
  }

  private admit(session: Session, resumed: boolean): void {
    session.status = "live";
    if (!session.resumeToken) session.resumeToken = newResumeToken(session.id);
    const spawn = this.descriptor.spawn;
    const state: RoomPlayer = { id: session.id, name: session.name, look: session.look, x: spawn.x, z: spawn.z, f: round(spawn.facing), d: null };
    this.live.set(session.id, {
      session,
      state,
      dirty: false,
      jumped: false,
      budget: movementBudgetCap,
      budgetAt: performance.now(),
      lastCorrectionAt: 0,
      trustNextPose: resumed,
    });
    this.occupancy = { ...this.occupancy, players: Math.max(this.occupancy.players, this.live.size + this.remote.size) };
    session.send({
      t: "welcome",
      you: session.id,
      resume: session.resumeToken,
      resumed,
      room: { id: this.id, capacity: this.membership.capacity },
      tickMs: this.settings.tickMs,
      players: this.roster().filter((player) => player.id !== session.id),
      music: this.musicState ? stamped(this.musicState) : null,
      occupancy: this.occupancy,
    });
    this.broadcast({ t: "join", player: state }, session);
    this.bus.publish(this.id, { k: "join", player: state });
    this.log.info({ session: session.id, ip: session.ip, resumed, name: session.name }, "player joined room");
    if (!this.musicState && this.music && this.descriptor.hasMusic) {
      this.track(this.music.state(this.id).then((state) => {
        this.musicState = state;
        session.send({ t: "music", state: stamped(state) });
      }));
    }
  }

  private async release(session: Session): Promise<void> {
    const tracked = this.sessions.get(session.id) === session;
    const wasLive = this.live.get(session.id)?.session === session;
    session.status = "closed";
    if (session.replaced || !tracked) return;
    this.sessions.delete(session.id);
    if (wasLive) {
      this.live.delete(session.id);
      this.broadcast({ t: "leave", id: session.id });
      this.bus.publish(this.id, { k: "leave", id: session.id });
    }
    if (wasLive && !session.leaving) {
      await this.membership.hold(session.id, session.resumeToken, this.settings.resumeGraceMs);
    } else {
      await this.membership.leave(session.id);
    }
    this.log.info({ session: session.id, held: wasLive && !session.leaving }, wasLive ? "player left room" : "player left queue");
    await this.promoteAndAdmit();
    if (!wasLive) {
      this.bus.publish(this.id, { k: "queue" });
      await this.reconcileQueue();
    }
  }

  private async promoteAndAdmit(): Promise<void> {
    const admitted = await this.membership.promote();
    if (!admitted.length) return;
    this.log.info({ admitted }, "admitted players from the queue");
    this.bus.publish(this.id, { k: "queue" });
    await this.reconcileQueue();
  }

  private async reconcileQueue(): Promise<void> {
    if (this.reconciling) {
      this.reconcileAgain = true;
      return;
    }
    this.reconciling = true;
    try {
      do {
        this.reconcileAgain = false;
        const queued = [...this.sessions.values()].filter((session) => session.status === "queued");
        const { standings, inside, waiting } = await this.membership.standings(queued.map((session) => session.id));
        const next = { players: inside, capacity: this.membership.capacity, queued: waiting };
        const key = `${inside}/${waiting}`;
        const changed = key !== this.announcedOccupancy;
        this.announcedOccupancy = key;
        this.occupancy = next;
        for (const session of queued) {
          if (session.status !== "queued" || this.sessions.get(session.id) !== session) continue;
          const standing = standings.get(session.id);
          if (standing?.admitted) {
            this.admit(session, false);
          } else if (standing?.position && (standing.position !== session.lastQueuePosition || changed)) {
            session.lastQueuePosition = standing.position;
            session.send({ t: "queued", position: standing.position, occupancy: next });
          }
        }
        if (changed) this.broadcast({ t: "occupancy", ...next });
      } while (this.reconcileAgain);
    } finally {
      this.reconciling = false;
    }
  }

  private async maintain(): Promise<void> {
    const now = Date.now();
    for (const [origin, seenAt] of this.remoteOrigins) {
      if (now - seenAt > remoteOriginTimeoutMs) this.applyRoster(origin, []);
    }
    await this.promoteAndAdmit();
    await this.reconcileQueue();
  }

  private async refreshLeases(): Promise<void> {
    const members: string[] = [];
    const queued: string[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === "live") members.push(session.id);
      else if (session.status === "queued") queued.push(session.id);
    }
    const requeued = await this.membership.refresh(members, queued);
    if (requeued.length) this.log.warn({ requeued }, "restored lost queue entries");
  }

  private tick(): void {
    if (!this.live.size) return;
    const deltas: PlayerDelta[] = [];
    for (const player of this.live.values()) {
      if (!player.dirty) continue;
      deltas.push(toDelta(player.state, player.jumped));
      player.dirty = false;
      player.jumped = false;
    }
    if (deltas.length) {
      this.broadcastDroppable(JSON.stringify({ t: "tick", p: deltas }));
      this.bus.publish(this.id, { k: "tick", p: deltas });
    }
    let snapshot: string | null = null;
    for (const player of this.live.values()) {
      const session = player.session;
      if (!session.needsSnapshot || !session.canTakeDroppable) continue;
      snapshot ??= JSON.stringify({ t: "snapshot", players: this.roster() });
      session.needsSnapshot = false;
      session.send(snapshot);
    }
  }

  private publishRoster(): void {
    if (!this.live.size) return;
    this.bus.publish(this.id, { k: "roster", players: [...this.live.values()].map((player) => player.state) });
  }

  private applyRoster(origin: string, players: RoomPlayer[]): void {
    if (players.length) this.remoteOrigins.set(origin, Date.now());
    else this.remoteOrigins.delete(origin);
    const listed = new Set(players.map((player) => player.id));
    for (const [id, known] of this.remote) {
      if (known.origin !== origin || listed.has(id)) continue;
      this.remote.delete(id);
      this.broadcast({ t: "leave", id });
    }
    for (const player of players) {
      if (this.live.has(player.id)) continue;
      const known = this.remote.get(player.id);
      if (known) {
        Object.assign(known.player, player);
        known.origin = origin;
        continue;
      }
      this.remote.set(player.id, { player, origin });
      this.broadcast({ t: "join", player });
    }
  }

  private roster(): RoomPlayer[] {
    return [...[...this.live.values()].map((player) => player.state), ...[...this.remote.values()].map((known) => known.player)];
  }

  private broadcast(message: ServerMessage, except?: Session): void {
    const text = JSON.stringify(message);
    for (const player of this.live.values()) {
      if (player.session !== except) player.session.send(text);
    }
  }

  private broadcastDroppable(text: string): void {
    for (const player of this.live.values()) {
      if (!player.session.needsSnapshot) player.session.send(text, true);
    }
  }
}
