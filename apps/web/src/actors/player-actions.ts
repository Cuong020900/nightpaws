import * as THREE from "three";
import { sipPeriod, type OfficePoseKey } from "../characters/office-poses.ts";
import { OfficeProps, talkingFrames } from "../scenes/office/office-props.ts";
import type { DrinkKind, DrinkSpot, SceneModule, SeatSpot } from "../scenes/scene-module.ts";
import type { CharacterActor } from "./character-actor.ts";

export interface PlayerActionState {
  seated: boolean;
  holding: boolean;
  talking: boolean;
  seatNearby: boolean;
  drinkNearby: boolean;
}

type SitPhase = "standing" | "entering" | "seated" | "leaving";

const seatReach = 1.8;
const drinkReach = 1.7;
const enterSeconds = 0.5;
const leaveSeconds = 0.38;
const pourSeconds = 1.7;
const cupGrowRate = 7;
const typingSeconds = 0.75;
const phraseSeconds = 3.4;
const bubbleHeight = 0.42;
const bubbleRise = 0.8;
const phrases = ["Hey there!", "Love this song!", "Nice moves!", "Coffee break?", "Let's dance!", "Who's the DJ?"];

const between = (min: number, max: number) => min + Math.random() * (max - min);
const ease = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);

export class PlayerActions {
  private readonly props = new OfficeProps();
  private readonly cup: THREE.Group;
  private readonly bubble: THREE.Sprite;
  private readonly glideFrom = new THREE.Vector3();
  private readonly glideTo = new THREE.Vector3();
  private readonly exitPoint = new THREE.Vector3();
  private phase: SitPhase = "standing";
  private glide = 0;
  private seat: SeatSpot | null = null;
  private seatFacing = 0;
  private seatScene: SceneModule | null = null;
  private holding = false;
  private cupScale = 0;
  private pourLeft = 0;
  private pourFacing = 0;
  private sipIn = between(2.5, 5);
  private sipUntil = 0;
  private talkLeft = 0;
  private talkTotal = 0;
  private phrase = "";
  private phraseIndex = -1;
  private bubblePop = 0;
  private elapsed = 0;

  constructor(private readonly actor: CharacterActor) {
    this.cup = this.props.cup(1);
    this.cup.scale.setScalar(0);
    this.bubble = this.props.bubble();
    actor.object.add(this.bubble);
  }

  get seated(): boolean {
    return this.phase === "entering" || this.phase === "seated";
  }

  get busy(): boolean {
    return this.phase !== "standing";
  }

  state(scene: SceneModule): PlayerActionState {
    return {
      seated: this.seated,
      holding: this.holding,
      talking: this.talkLeft > 0,
      seatNearby: !this.busy && this.nearestSeat(scene) !== null,
      drinkNearby: !this.holding && this.nearestDrink(scene) !== null,
    };
  }

  toggleSit(scene: SceneModule): void {
    if (this.phase === "leaving") return;
    if (this.seated) {
      this.stand();
      return;
    }
    if (this.actor.isAirborne) return;
    this.actor.stopDancing();
    this.pourLeft = 0;
    const position = this.actor.position;
    this.glideFrom.copy(position);
    this.exitPoint.copy(position);
    const nearest = this.nearestSeat(scene);
    if (nearest) {
      const [index, seat] = nearest;
      scene.occupySeat(index);
      this.seatScene = scene;
      this.seat = seat;
      this.seatFacing = seat.facing;
      this.glideTo.set(seat.x, 0, seat.z);
      this.actor.sit(seat.height);
    } else {
      this.seat = null;
      this.seatFacing = this.actor.facing;
      this.glideTo.copy(position);
      this.actor.sitOnFloor();
    }
    this.phase = "entering";
    this.glide = 0;
  }

  stand(): void {
    if (!this.seated) return;
    this.seatScene?.occupySeat(null);
    this.seatScene = null;
    this.actor.sit(null);
    this.glideFrom.copy(this.actor.position);
    this.glideTo.copy(this.exitPoint);
    this.phase = "leaving";
    this.glide = 0;
  }

  toggleHold(scene: SceneModule): void {
    if (this.holding) {
      this.holding = false;
      this.pourLeft = 0;
      return;
    }
    const nearest = this.nearestDrink(scene);
    const drink: DrinkKind = nearest?.drink ?? scene.drinkSpots[0]?.drink ?? "water";
    this.props.fill(this.cup, drink);
    this.holding = true;
    this.actor.holdCup(this.cup);
    this.sipIn = between(2.5, 5);
    if (nearest && this.phase === "standing" && !this.actor.isDancing) {
      this.pourLeft = pourSeconds;
      this.pourFacing = nearest.facing;
    }
  }

  talk(): void {
    this.phraseIndex = (this.phraseIndex + 1) % phrases.length;
    this.phrase = phrases[this.phraseIndex]!;
    const fresh = this.talkLeft <= 0;
    this.talkTotal = (fresh ? typingSeconds : 0) + phraseSeconds;
    this.talkLeft = this.talkTotal;
    if (fresh) this.bubblePop = 0;
  }

  reset(): void {
    this.seatScene?.occupySeat(null);
    this.seatScene = null;
    this.seat = null;
    this.phase = "standing";
    this.actor.sit(null);
    this.holding = false;
    this.cupScale = 0;
    this.cup.scale.setScalar(0);
    this.actor.holdCup(null);
    this.pourLeft = 0;
    this.talkLeft = 0;
    this.bubble.visible = false;
    this.actor.act(null);
  }

  update(deltaSeconds: number, elapsedSeconds: number, wantsToMove: boolean): boolean {
    this.elapsed = elapsedSeconds;
    const locked = this.updateSeat(deltaSeconds, wantsToMove);
    if (wantsToMove || this.actor.isDancing) this.pourLeft = 0;
    if (this.pourLeft > 0) {
      this.pourLeft -= deltaSeconds;
      this.actor.turnTo(this.pourFacing, deltaSeconds);
    }
    this.talkLeft = Math.max(0, this.talkLeft - deltaSeconds);
    this.updateCup(deltaSeconds);
    this.actor.act(this.activity(deltaSeconds, wantsToMove));
    this.updateBubble(deltaSeconds);
    return locked;
  }

  private updateSeat(deltaSeconds: number, wantsToMove: boolean): boolean {
    const position = this.actor.position;
    switch (this.phase) {
      case "standing":
        return false;
      case "entering":
      case "seated":
        if (wantsToMove) {
          this.stand();
          return true;
        }
        this.actor.turnTo(this.seatFacing, deltaSeconds);
        if (this.phase === "entering") {
          this.glide = Math.min(1, this.glide + deltaSeconds / enterSeconds);
          position.lerpVectors(this.glideFrom, this.glideTo, ease(this.glide));
          if (this.glide >= 1) this.phase = "seated";
        }
        return true;
      case "leaving":
        this.glide = Math.min(1, this.glide + deltaSeconds / leaveSeconds);
        position.lerpVectors(this.glideFrom, this.glideTo, ease(this.glide));
        if (this.glide >= 1) {
          this.phase = "standing";
          this.seat = null;
        }
        return this.phase !== "standing";
    }
  }

  private updateCup(deltaSeconds: number): void {
    const target = this.holding ? 1 : 0;
    if (this.cupScale === target) return;
    const step = deltaSeconds * cupGrowRate;
    this.cupScale = target > this.cupScale ? Math.min(target, this.cupScale + step) : Math.max(target, this.cupScale - step);
    const t = this.cupScale;
    this.cup.scale.setScalar(this.holding ? ease(t) * (1 + 0.25 * Math.sin(Math.PI * t)) : ease(t));
    if (!this.holding && this.cupScale === 0) this.actor.holdCup(null);
  }

  private activity(deltaSeconds: number, moving: boolean): OfficePoseKey | null {
    if (this.actor.isDancing) return null;
    if (this.talkLeft > 0) return "talking";
    if (this.pourLeft > 0) return "pouring";
    if (this.holding) {
      if (moving || this.elapsed < this.sipUntil) return this.elapsed < this.sipUntil ? "sipping" : "holding";
      this.sipIn -= deltaSeconds;
      if (this.sipIn <= 0 && this.actor.sipPhase(this.elapsed) < 0.05) {
        this.sipIn = between(3, 7);
        this.sipUntil = this.elapsed + sipPeriod * 0.95;
        return "sipping";
      }
      return "holding";
    }
    if (this.phase === "seated" && this.seat?.desk) return "typing";
    return null;
  }

  private updateBubble(deltaSeconds: number): void {
    const { bubble } = this;
    const talking = this.talkLeft > 0;
    this.bubblePop = THREE.MathUtils.clamp(this.bubblePop + (talking ? deltaSeconds : -deltaSeconds) * 6, 0, 1);
    bubble.visible = this.bubblePop > 0;
    if (!bubble.visible) return;
    const sinceStart = this.talkTotal - this.talkLeft;
    const typing = talking && this.talkTotal > phraseSeconds && sinceStart < typingSeconds;
    const material = typing ? this.props.bubbleMaterial(talkingFrames[Math.floor(this.elapsed * 6) % talkingFrames.length]!) : this.props.speechMaterial(this.phrase);
    bubble.material = material;
    const height = bubbleHeight * (typing ? 0.82 : 1);
    const pop = ease(this.bubblePop) * (1 + 0.12 * Math.sin(Math.PI * this.bubblePop));
    bubble.scale.set(height * this.props.bubbleAspect(material) * pop, height * pop, 1);
    bubble.position.y = this.actor.crownHeight + bubbleRise + 0.03 * Math.sin(this.elapsed * 4);
  }

  private nearestSeat(scene: SceneModule): [number, SeatSpot] | null {
    const position = this.actor.position;
    let best: [number, SeatSpot] | null = null;
    let bestDistance = seatReach;
    for (const [index, seat] of scene.seats.entries()) {
      const distance = Math.hypot(seat.x - position.x, seat.z - position.z);
      if (distance < bestDistance && scene.isSeatFree(index)) {
        bestDistance = distance;
        best = [index, seat];
      }
    }
    return best;
  }

  private nearestDrink(scene: SceneModule): DrinkSpot | null {
    const position = this.actor.position;
    let best: DrinkSpot | null = null;
    let bestDistance = drinkReach;
    for (const spot of scene.drinkSpots) {
      const distance = Math.hypot(spot.x - position.x, spot.z - position.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = spot;
      }
    }
    return best;
  }
}
