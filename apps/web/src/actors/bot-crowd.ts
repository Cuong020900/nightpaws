import { characterTypes, outfits, type DanceMoveId, type FloorRect } from "@nightpaws/shared";
import * as THREE from "three";
import type { ViewSample } from "../engine/view-sample.ts";
import type { WalkableSpace } from "../engine/walkable-space.ts";
import type { MusicPulse, SceneModule } from "../scenes/scene-module.ts";
import { CharacterActor, type ActorTiming } from "./character-actor.ts";
import { freeCrowd, type CrowdCue } from "./crowd-cue.ts";

type BotActivity =
  | { kind: "walk"; target: THREE.Vector3; then: "dance" | "idle" }
  | { kind: "idle"; remaining: number }
  | { kind: "dance"; remaining: number; clip: DanceMoveId };

interface Bot {
  actor: CharacterActor;
  activity: BotActivity;
}

const labelAccents = ["#26f0ff", "#ff2e88", "#ffd23f", "#9b5cff", "#3dff8a"];
const personalSpace = 0.95;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class BotCrowd {
  private readonly bots: Bot[] = [];
  private readonly desiredVelocity = new THREE.Vector3();
  private cue: CrowdCue = freeCrowd;
  private names: string[] = [];
  private spawned = 0;

  constructor(
    private readonly scene: SceneModule,
    private readonly space: WalkableSpace,
    private readonly parent: THREE.Object3D,
  ) {}

  get actors(): CharacterActor[] {
    return this.bots.map((bot) => bot.actor);
  }

  get count(): number {
    return this.bots.length;
  }

  populate(count: number, namePool: string[]): void {
    this.names = [...namePool].sort(() => Math.random() - 0.5);
    this.add(count);
  }

  resize(target: number): void {
    while (this.bots.length > target) this.bots.pop()!.actor.dispose();
    if (this.bots.length < target) this.add(target - this.bots.length);
  }

  private add(count: number): void {
    for (let step = 0; step < count; step += 1) {
      const index = this.spawned;
      this.spawned += 1;
      const actor = new CharacterActor({
        name: this.names[index % this.names.length] ?? `Bot ${index + 1}`,
        appearance: { characterTypeId: pick(characterTypes).id, outfitId: pick(outfits).id },
        labelAccent: labelAccents[index % labelAccents.length]!,
        danceIntensity: 0.85,
      });
      const area = index % 2 === 0 ? this.scene.danceArea : pick(this.scene.loungeAreas);
      actor.position.copy(this.space.randomFreePoint(area, actor.radius));
      actor.facing = Math.random() * Math.PI * 2;
      actor.setCue(this.cue);
      this.parent.add(actor.object);
      this.bots.push({ actor, activity: { kind: "idle", remaining: randomBetween(0.2, 2.5) } });
    }
  }

  setCue(cue: CrowdCue): void {
    this.cue = cue;
    for (const bot of this.bots) {
      bot.actor.setCue(cue);
      if (cue.kind === "free") bot.activity = { kind: "idle", remaining: randomBetween(0.3, 2.5) };
    }
  }

  update(deltaSeconds: number, timing: ActorTiming, music: MusicPulse, others: CharacterActor[], view: ViewSample, leader: THREE.Vector3): void {
    for (const bot of this.bots) {
      if (this.cue.kind === "free") this.advanceActivity(bot, deltaSeconds, music);
      else if (this.cue.kind === "sync") bot.actor.faceTowards(leader, deltaSeconds);
      bot.actor.update(deltaSeconds, timing, view);
    }
    this.keepPersonalSpace([...this.actors, ...others]);
  }

  dispose(): void {
    for (const bot of this.bots) bot.actor.dispose();
    this.bots.length = 0;
  }

  private advanceActivity(bot: Bot, deltaSeconds: number, music: MusicPulse): void {
    const { actor, activity } = bot;
    switch (activity.kind) {
      case "walk": {
        const toTarget = new THREE.Vector3().subVectors(activity.target, actor.position).setY(0);
        const distance = toTarget.length();
        if (distance < 0.25) {
          bot.activity =
            activity.then === "dance"
              ? { kind: "dance", remaining: randomBetween(7, 16), clip: pick(actor.descriptor.dances) }
              : { kind: "idle", remaining: randomBetween(2, 6) };
          if (bot.activity.kind === "dance") actor.dance(bot.activity.clip);
          return;
        }
        const speed = actor.descriptor.walkSpeed * 0.5;
        this.desiredVelocity.copy(toTarget).multiplyScalar(Math.min(speed, distance * 3) / distance);
        actor.moveWithVelocity(deltaSeconds, this.desiredVelocity, this.space);
        return;
      }
      case "dance": {
        activity.remaining -= deltaSeconds * (music.isPlaying ? 1 : 3);
        if (activity.remaining <= 0) {
          actor.stopDancing();
          this.chooseNextActivity(bot, music);
        }
        return;
      }
      case "idle": {
        actor.faceTowards(this.scene.showcaseSpot, deltaSeconds);
        activity.remaining -= deltaSeconds;
        if (activity.remaining <= 0 || (music.isPlaying && Math.random() < deltaSeconds * 0.15)) {
          this.chooseNextActivity(bot, music);
        }
      }
    }
  }

  private chooseNextActivity(bot: Bot, music: MusicPulse): void {
    const roll = Math.random();
    const danceChance = music.isPlaying ? 0.7 : 0.15;
    const loungeChance = music.isPlaying ? 0.15 : 0.45;
    let destination: FloorRect;
    let then: "dance" | "idle";
    if (roll < danceChance) {
      destination = this.scene.danceArea;
      then = "dance";
    } else if (roll < danceChance + loungeChance) {
      destination = pick(this.scene.loungeAreas);
      then = "idle";
    } else {
      destination = this.space.bounds;
      then = "idle";
    }
    bot.activity = { kind: "walk", target: this.pickTargetOffStage(destination, bot.actor.radius), then };
  }

  private pickTargetOffStage(area: FloorRect, radius: number): THREE.Vector3 {
    const stage = this.scene.showcaseStage;
    let target = this.space.randomFreePoint(area, radius);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const onStage = target.x > stage.minX && target.x < stage.maxX && target.z > stage.minZ && target.z < stage.maxZ;
      if (!onStage) return target;
      target = this.space.randomFreePoint(area, radius);
    }
    return target;
  }

  private keepPersonalSpace(everyone: CharacterActor[]): void {
    for (let first = 0; first < everyone.length; first += 1) {
      for (let second = first + 1; second < everyone.length; second += 1) {
        const a = everyone[first]!;
        const b = everyone[second]!;
        const offsetX = b.position.x - a.position.x;
        const offsetZ = b.position.z - a.position.z;
        const distance = Math.hypot(offsetX, offsetZ);
        if (distance >= personalSpace || distance < 1e-4) continue;
        const push = (personalSpace - distance) / distance / 2;
        const aIsBot = this.bots.some((bot) => bot.actor === a);
        const bIsBot = this.bots.some((bot) => bot.actor === b);
        const aShare = aIsBot ? (bIsBot ? 1 : 2) : 0;
        const bShare = bIsBot ? (aIsBot ? 1 : 2) : 0;
        a.position.x -= offsetX * push * aShare;
        a.position.z -= offsetZ * push * aShare;
        b.position.x += offsetX * push * bShare;
        b.position.z += offsetZ * push * bShare;
        this.space.constrain(a.position, a.radius);
        this.space.constrain(b.position, b.radius);
      }
    }
  }
}
