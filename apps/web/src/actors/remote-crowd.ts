import type { CharacterAppearance, DanceMoveId, PlayerDelta, RoomPlayer } from "@nightpaws/shared";
import * as THREE from "three";
import type { ViewSample } from "../engine/view-sample.ts";
import { CharacterActor, type ActorTiming } from "./character-actor.ts";

interface Sample {
  at: number;
  x: number;
  z: number;
  f: number;
}

interface RemoteAvatar {
  actor: CharacterActor;
  samples: Sample[];
  facing: number;
  dance: DanceMoveId | null;
  jumpPending: boolean;
}

const labelAccents = ["#3dff8a", "#ffd23f", "#26f0ff", "#ff7ad9", "#b48cff", "#ff9f43"];
const snapDistance = 4;
const maxRemoteSpeed = 9;

function accentFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return labelAccents[Math.abs(hash) % labelAccents.length]!;
}

export class RemoteCrowd {
  private readonly avatars = new Map<string, RemoteAvatar>();
  private readonly velocity = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private tickMs = 100;

  constructor(private readonly parent: THREE.Object3D) {}

  get count(): number {
    return this.avatars.size;
  }

  get actors(): CharacterActor[] {
    return [...this.avatars.values()].map((avatar) => avatar.actor);
  }

  setTickInterval(tickMs: number): void {
    this.tickMs = tickMs;
  }

  reset(players: RoomPlayer[], selfId: string | null): void {
    const present = new Set(players.map((player) => player.id));
    for (const id of [...this.avatars.keys()]) if (!present.has(id)) this.remove(id);
    for (const player of players) if (player.id !== selfId) this.upsert(player);
  }

  upsert(player: RoomPlayer): void {
    const existing = this.avatars.get(player.id);
    if (existing) {
      this.setLook(player.id, player.name, player.look);
      this.push(existing, player.x, player.z, player.f);
      existing.dance = player.d;
      return;
    }
    const actor = new CharacterActor({
      name: player.name,
      appearance: player.look,
      labelAccent: accentFor(player.id),
      highlighted: true,
    });
    actor.position.set(player.x, 0, player.z);
    actor.facing = player.f;
    this.parent.add(actor.object);
    this.avatars.set(player.id, {
      actor,
      samples: [{ at: performance.now(), x: player.x, z: player.z, f: player.f }],
      facing: player.f,
      dance: player.d,
      jumpPending: false,
    });
  }

  remove(id: string): void {
    const avatar = this.avatars.get(id);
    if (!avatar) return;
    avatar.actor.dispose();
    this.avatars.delete(id);
  }

  clear(): void {
    for (const id of [...this.avatars.keys()]) this.remove(id);
  }

  setLook(id: string, name: string, look: CharacterAppearance): void {
    const avatar = this.avatars.get(id);
    if (!avatar) return;
    if (avatar.actor.displayName !== name) avatar.actor.setName(name);
    const current = avatar.actor.appearance;
    if (current.characterTypeId !== look.characterTypeId || current.outfitId !== look.outfitId) avatar.actor.setAppearance(look);
  }

  applyDeltas(deltas: PlayerDelta[], selfId: string | null): void {
    for (const [id, x, z, f, dance, jumped] of deltas) {
      if (id === selfId) continue;
      const avatar = this.avatars.get(id);
      if (!avatar) continue;
      this.push(avatar, x, z, f);
      avatar.dance = dance;
      if (jumped) avatar.jumpPending = true;
    }
  }

  update(deltaSeconds: number, timing: ActorTiming, view: ViewSample): void {
    const renderAt = performance.now() - (this.tickMs + 60);
    for (const avatar of this.avatars.values()) {
      this.advance(avatar, renderAt, deltaSeconds);
      avatar.actor.update(deltaSeconds, timing, view);
    }
  }

  private push(avatar: RemoteAvatar, x: number, z: number, f: number): void {
    const now = performance.now();
    const last = avatar.samples[avatar.samples.length - 1];
    if (last && now - last.at > this.tickMs * 2) avatar.samples.push({ at: now - this.tickMs, x: last.x, z: last.z, f: last.f });
    avatar.samples.push({ at: now, x, z, f });
    if (avatar.samples.length > 30) avatar.samples.splice(0, avatar.samples.length - 30);
  }

  private advance(avatar: RemoteAvatar, renderAt: number, deltaSeconds: number): void {
    const { samples, actor } = avatar;
    while (samples.length > 2 && samples[1]!.at <= renderAt) samples.shift();
    const from = samples[0]!;
    const to = samples[1];
    if (to && to.at > from.at && renderAt > from.at) {
      const t = Math.min(1, (renderAt - from.at) / (to.at - from.at));
      this.target.set(THREE.MathUtils.lerp(from.x, to.x, t), 0, THREE.MathUtils.lerp(from.z, to.z, t));
      avatar.facing = t < 0.5 ? from.f : to.f;
    } else {
      const latest = to && renderAt >= to.at ? to : from;
      this.target.set(latest.x, 0, latest.z);
      avatar.facing = latest.f;
    }

    const distance = this.target.distanceTo(actor.position);
    if (distance > snapDistance) {
      actor.position.copy(this.target);
    } else if (deltaSeconds > 0) {
      this.velocity.subVectors(this.target, actor.position).divideScalar(deltaSeconds);
      if (this.velocity.length() > maxRemoteSpeed) this.velocity.setLength(maxRemoteSpeed);
      actor.moveWithVelocity(deltaSeconds, this.velocity, null);
    }

    const moving = distance > 0.02;
    if (!moving) {
      actor.turnTo(avatar.facing, deltaSeconds);
      if (avatar.dance && actor.currentDance !== avatar.dance) actor.dance(avatar.dance);
      if (!avatar.dance && actor.currentDance) actor.stopDancing();
    }
    if (avatar.jumpPending) {
      avatar.jumpPending = false;
      actor.jump();
    }
  }
}
