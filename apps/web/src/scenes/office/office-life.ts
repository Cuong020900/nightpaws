import * as THREE from "three";
import { CharacterActor } from "../../actors/character-actor.ts";
import { freeCrowd, type CrowdCue } from "../../actors/crowd-cue.ts";
import { sipPeriod } from "../../characters/office-poses.ts";
import type { DrinkSpot, SceneFrame, SeatSpot } from "../scene-module.ts";
import type { DeskSeat } from "./office-architecture.ts";
import { OfficeProps, talkingFrames, type BubbleKind } from "./office-props.ts";
import { buildOfficeMap, type ChatCluster, type OfficeMap, type Spot } from "./office-routes.ts";

export type OfficeRoutine = "desk" | "cooler" | "chat" | "dance";

export interface OfficeWorker {
  name: string;
  characterTypeId: string;
  outfitId: string;
  seat: number;
  routine: OfficeRoutine;
  cluster?: number;
}

interface Huddle {
  cluster: ChatCluster;
  speaker: Worker | null;
  turnLeft: number;
}

interface Worker {
  actor: CharacterActor;
  bubble: THREE.Sprite;
  cup: THREE.Group;
  seat: Spot;
  seatIndex: number;
  routine: OfficeRoutine;
  spot: Spot;
  huddle: Huddle | null;
  path: THREE.Vector3[];
  step: number;
  pause: number;
  arrived: boolean;
  remaining: number;
  pourLeft: number;
  holding: boolean;
  sipIn: number;
  sipUntil: number;
  emote: BubbleKind | null;
  emoteLeft: number;
}

export const seatTop = 0.55;

const nextWeights: Record<OfficeRoutine, Record<OfficeRoutine, number>> = {
  desk: { desk: 0, cooler: 0.45, chat: 0.3, dance: 0.25 },
  cooler: { desk: 0.3, cooler: 0, chat: 0.5, dance: 0.2 },
  chat: { desk: 0.4, cooler: 0.15, chat: 0, dance: 0.45 },
  dance: { desk: 0.5, cooler: 0.3, chat: 0.2, dance: 0 },
};

const between = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;

export class OfficeLife {
  readonly actors: CharacterActor[];
  readonly seatSpots: SeatSpot[];
  readonly drinkSpots: DrinkSpot[];
  private readonly map: OfficeMap;
  private readonly props = new OfficeProps();
  private readonly workers: Worker[];
  private readonly huddles: Huddle[];
  private readonly claimed = new Set<Spot>();
  private readonly velocity = new THREE.Vector3();
  private readonly toTarget = new THREE.Vector3();
  private cue: CrowdCue = freeCrowd;
  private elapsed = 0;
  private reserved: Spot | null = null;

  constructor(parent: THREE.Object3D, deskSeats: DeskSeat[], roster: readonly OfficeWorker[]) {
    this.map = buildOfficeMap(deskSeats);
    this.huddles = this.map.clusters.map((cluster) => ({ cluster, speaker: null, turnLeft: 0 }));
    this.workers = roster.map((member, index) => this.hire(parent, member, index));
    roster.forEach((member, index) => this.start(this.workers[index]!, index, member));
    this.actors = this.workers.map((worker) => worker.actor);
    this.seatSpots = this.map.seats.map((spot) => {
      const { x, z } = this.map.routes.point(spot.node);
      return { x, z, facing: spot.facing, height: seatTop, desk: true };
    });
    this.drinkSpots = this.map.drinkSpots.map((spot) => {
      const { x, z } = this.map.routes.point(spot.node);
      return { x, z, facing: spot.facing, drink: spot.coffee ? "coffee" : "water" };
    });
  }

  isSeatBusy(seatIndex: number): boolean {
    if (this.reserved === this.map.seats[seatIndex]) return true;
    return this.workers.some((worker) => worker.seatIndex === seatIndex && worker.routine === "desk" && worker.arrived);
  }

  isSeatFree(seatIndex: number): boolean {
    const spot = this.map.seats[seatIndex];
    return spot !== undefined && spot !== this.reserved && !this.claimed.has(spot);
  }

  reserveSeat(seatIndex: number | null): void {
    this.reserved = seatIndex === null ? null : (this.map.seats[seatIndex] ?? null);
  }

  setCue(cue: CrowdCue): void {
    this.cue = cue;
    for (const worker of this.workers) worker.actor.setCue(cue);
  }

  update(frame: SceneFrame): void {
    const dt = frame.deltaSeconds;
    this.elapsed = frame.elapsedSeconds;
    const free = this.cue.kind === "free";
    if (free) {
      for (const worker of this.workers) this.advance(worker, dt, frame.music.isPlaying);
      for (const huddle of this.huddles) this.runHuddle(huddle, dt);
    }
    const timing = { elapsedSeconds: frame.elapsedSeconds, beats: frame.music.beats };
    for (const worker of this.workers) {
      this.updateBubble(worker, dt, free);
      worker.actor.update(dt, timing, frame.view);
    }
  }

  dispose(): void {
    for (const worker of this.workers) worker.actor.dispose();
    this.props.dispose();
  }

  private hire(parent: THREE.Object3D, member: OfficeWorker, index: number): Worker {
    const actor = new CharacterActor({
      name: member.name,
      appearance: { characterTypeId: member.characterTypeId, outfitId: member.outfitId },
      labelAccent: "#ffffff",
      showLabel: false,
      danceIntensity: 0.85,
    });
    const bubble = this.props.bubble();
    bubble.position.set(0, actor.headHeight + 0.2, 0);
    actor.object.add(bubble);
    parent.add(actor.object);
    const seat = this.map.seats[member.seat]!;
    return {
      actor,
      bubble,
      cup: this.props.cup(index),
      seat,
      seatIndex: member.seat,
      routine: member.routine,
      spot: seat,
      huddle: null,
      path: [],
      step: 0,
      pause: 0,
      arrived: false,
      remaining: 0,
      pourLeft: 0,
      holding: false,
      sipIn: between(2, 6),
      sipUntil: 0,
      emote: null,
      emoteLeft: 0,
    };
  }

  private start(worker: Worker, index: number, member: OfficeWorker): void {
    const spot = this.destination(worker, member.routine, member.cluster === undefined ? undefined : this.huddles[member.cluster]);
    if (!spot) return;
    worker.actor.position.copy(this.map.routes.point(spot.node));
    worker.actor.facing = spot.facing;
    this.arrive(worker);
    worker.remaining *= 0.6 + 0.4 * ((index * 0.37) % 1);
    if (member.routine === "cooler") {
      worker.pourLeft = 0;
      this.grabCup(worker);
      worker.actor.act("sipping");
    }
  }

  private destination(worker: Worker, routine: OfficeRoutine, huddle?: Huddle): Spot | null {
    let spot: Spot | null = null;
    let joined: Huddle | null = null;
    if (routine === "desk") spot = worker.seat === this.reserved ? null : worker.seat;
    if (routine === "cooler") spot = this.map.drinkSpots.find((drink) => !this.claimed.has(drink)) ?? null;
    if (routine === "dance") {
      const open = this.map.danceSpots.filter((dance) => !this.claimed.has(dance));
      spot = open.length ? pick(open) : null;
    }
    if (routine === "chat") {
      joined = huddle ?? this.chooseHuddle();
      spot = joined?.cluster.spots.find((place) => !this.claimed.has(place)) ?? null;
    }
    if (!spot) return null;
    this.claimed.add(spot);
    worker.routine = routine;
    worker.spot = spot;
    worker.huddle = routine === "chat" ? joined : null;
    return spot;
  }

  private chooseHuddle(): Huddle | null {
    const members = (huddle: Huddle) => huddle.cluster.spots.filter((spot) => this.claimed.has(spot)).length;
    const joinable = this.huddles.filter((huddle) => members(huddle) > 0 && members(huddle) < huddle.cluster.spots.length);
    if (joinable.length) return pick(joinable);
    const empty = this.huddles.filter((huddle) => members(huddle) === 0);
    return empty.length ? pick(empty) : null;
  }

  private send(worker: Worker, routine: OfficeRoutine, huddle?: Huddle): boolean {
    const from = worker.spot;
    this.claimed.delete(from);
    const spot = this.destination(worker, routine, huddle);
    if (!spot) {
      this.claimed.add(from);
      return false;
    }
    const { actor } = worker;
    worker.pause = from === worker.seat && worker.arrived ? 0.8 : 0.15;
    worker.arrived = false;
    actor.sit(null);
    actor.stopDancing();
    actor.act(worker.holding ? "holding" : null);
    worker.path = this.map.routes.route(from.node, spot.node);
    worker.step = 0;
    if (routine === "chat" && worker.huddle && this.countMembers(worker.huddle) === 1) this.recruit(worker, worker.huddle);
    return true;
  }

  private recruit(host: Worker, huddle: Huddle): void {
    const candidates = this.workers.filter((worker) => worker !== host && worker.arrived && (worker.routine === "desk" || worker.routine === "dance") && worker.remaining > 4);
    if (candidates.length) this.send(pick(candidates), "chat", huddle);
  }

  private countMembers(huddle: Huddle): number {
    return this.workers.filter((worker) => worker.huddle === huddle).length;
  }

  private chooseNext(worker: Worker, musicPlaying: boolean): void {
    const weights = nextWeights[worker.routine];
    const options = (Object.keys(weights) as OfficeRoutine[]).filter((routine) => weights[routine] > 0);
    const weight = (routine: OfficeRoutine) => weights[routine] * (routine === "dance" && musicPlaying ? 1.6 : 1);
    let roll = Math.random() * options.reduce((total, routine) => total + weight(routine), 0);
    for (const routine of options) {
      roll -= weight(routine);
      if (roll <= 0 && this.send(worker, routine)) return;
    }
    for (const routine of options) if (this.send(worker, routine)) return;
    worker.remaining = between(4, 8);
  }

  private advance(worker: Worker, dt: number, musicPlaying: boolean): void {
    const { actor } = worker;
    if (!worker.arrived) {
      if (worker.pause > 0) {
        worker.pause -= dt;
        return;
      }
      this.walk(worker, dt);
      return;
    }
    if (worker.routine !== "chat") actor.turnTo(worker.spot.facing, dt);
    if (worker.routine === "cooler" && worker.pourLeft > 0) {
      worker.pourLeft -= dt;
      if (worker.pourLeft <= 0) actor.act("sipping");
      return;
    }
    worker.remaining -= dt * (worker.routine === "dance" && !musicPlaying ? 1.4 : 1);
    if (worker.remaining <= 0) this.chooseNext(worker, musicPlaying);
  }

  private walk(worker: Worker, dt: number): void {
    const { actor } = worker;
    const target = worker.path[worker.step];
    if (!target) {
      this.arrive(worker);
      return;
    }
    const last = worker.step === worker.path.length - 1;
    this.toTarget.subVectors(target, actor.position).setY(0);
    const distance = this.toTarget.length();
    if (distance < (last ? 0.06 : 0.3)) {
      worker.step += 1;
      if (last) this.arrive(worker);
      return;
    }
    const speed = actor.descriptor.walkSpeed * 0.42;
    this.velocity.copy(this.toTarget).multiplyScalar(Math.min(speed, Math.max(0.6, distance * 4)) / distance);
    actor.moveWithVelocity(dt, this.velocity, null);
  }

  private arrive(worker: Worker): void {
    const { actor } = worker;
    worker.arrived = true;
    worker.path = [];
    actor.position.copy(this.map.routes.point(worker.spot.node));
    switch (worker.routine) {
      case "desk":
        this.dropCup(worker);
        actor.sit(seatTop);
        actor.act("typing");
        worker.remaining = between(16, 32);
        break;
      case "cooler":
        this.grabCup(worker);
        actor.act("pouring");
        worker.pourLeft = 1.9;
        worker.remaining = between(3, 5) * sipPeriod;
        break;
      case "chat":
        actor.act(worker.holding ? "holding" : "listening");
        worker.remaining = between(14, 24);
        break;
      case "dance":
        this.dropCup(worker);
        actor.act(null);
        actor.dance(pick(actor.descriptor.dances));
        worker.remaining = between(10, 20);
        break;
    }
  }

  private grabCup(worker: Worker): void {
    const drink = this.map.drinkSpots.find((spot) => spot === worker.spot);
    this.props.fill(worker.cup, drink?.coffee ? "coffee" : "water");
    worker.holding = true;
    worker.actor.holdCup(worker.cup);
  }

  private dropCup(worker: Worker): void {
    worker.holding = false;
    worker.actor.holdCup(null);
  }

  private runHuddle(huddle: Huddle, dt: number): void {
    const present = this.workers.filter((worker) => worker.huddle === huddle && worker.arrived);
    if (present.length < 2) {
      huddle.speaker = null;
      for (const worker of present) {
        worker.actor.faceTowards(huddle.cluster.center, dt);
        this.listen(worker, dt);
        if (this.countMembers(huddle) < 2) worker.remaining = Math.min(worker.remaining, 6);
      }
      return;
    }
    huddle.turnLeft -= dt;
    if (!huddle.speaker || !present.includes(huddle.speaker) || huddle.turnLeft <= 0) {
      const previous = huddle.speaker;
      huddle.speaker = pick(present.filter((worker) => worker !== previous));
      huddle.turnLeft = between(2.6, 5.2);
      const audience = present.filter((worker) => worker !== huddle.speaker);
      if (previous && Math.random() < 0.5) this.showEmote(pick(audience), Math.random() < 0.75 ? "laugh" : "idea");
    }
    for (const worker of present) {
      if (worker === huddle.speaker) {
        worker.actor.faceTowards(huddle.cluster.center, dt);
        worker.actor.act("talking");
      } else {
        worker.actor.faceTowards(huddle.speaker.actor.position, dt);
        this.listen(worker, dt);
      }
    }
  }

  private listen(worker: Worker, dt: number): void {
    const { actor } = worker;
    if (!worker.holding) {
      actor.act("listening");
      return;
    }
    if (this.elapsed < worker.sipUntil) return;
    if (actor.currentActivity === "sipping") worker.sipIn = between(3, 7);
    worker.sipIn -= dt;
    if (worker.sipIn <= 0 && actor.sipPhase(this.elapsed) < 0.05) {
      actor.act("sipping");
      worker.sipUntil = this.elapsed + sipPeriod * 0.95;
      return;
    }
    actor.act("holding");
  }

  private showEmote(worker: Worker, kind: BubbleKind): void {
    worker.emote = kind;
    worker.emoteLeft = 1.5;
  }

  private updateBubble(worker: Worker, dt: number, free: boolean): void {
    const { bubble, actor } = worker;
    worker.emoteLeft -= dt;
    if (worker.emoteLeft <= 0) worker.emote = null;
    const talking = free && worker.arrived && worker.routine === "chat" && actor.currentActivity === "talking";
    const kind = worker.emote ?? (talking ? talkingFrames[Math.floor(this.elapsed * 3) % talkingFrames.length]! : null);
    bubble.visible = free && kind !== null;
    if (kind) bubble.material = this.props.bubbleMaterial(kind);
    bubble.position.y = actor.headHeight + 0.2 + 0.03 * Math.sin(this.elapsed * 4);
  }
}
