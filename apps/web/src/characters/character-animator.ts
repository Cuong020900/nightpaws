import * as THREE from "three";
import type { CharacterModel } from "./character-model.ts";
import { addPose, applyPose, blendPose, dancePose, heroIdlePose, jumpPose, mirrorPose, scalePose, walkPose, zeroPose, type PoseKey } from "./dance-poses.ts";

export interface AnimationInput {
  deltaSeconds: number;
  elapsedSeconds: number;
  beats: number;
  moving: boolean;
  speed: number;
  stridePhase: number;
  dance: PoseKey | null;
  mirrored: boolean;
  intensity: number;
  lite: boolean;
  airborne: number;
  landing: number;
}

const lerp = THREE.MathUtils.lerp;

export class CharacterAnimator {
  private danceWeight = 0;
  private walkWeight = 0;
  private lastDance: PoseKey | null = null;
  private readonly offset = Math.random() * 10;
  private readonly beatOffset = Math.random() * 0.12;
  private blinkAt = 1 + Math.random() * 2;
  private blinkStart = -9;

  constructor(private readonly model: CharacterModel) {}

  get isDancing(): boolean {
    return this.danceWeight > 0.5;
  }

  update(input: AnimationInput): void {
    const model = this.model;
    const dt = input.deltaSeconds;
    for (const [bone, position, quaternion, scale] of model.rest) {
      bone.position.copy(position);
      bone.quaternion.copy(quaternion);
      bone.scale.copy(scale);
    }
    if (input.dance) this.lastDance = input.dance;
    this.walkWeight = lerp(this.walkWeight, input.moving ? 1 : 0, 1 - Math.exp(-dt * 8));
    this.danceWeight = lerp(this.danceWeight, input.dance && !input.moving ? 1 : 0, 1 - Math.exp(-dt * 3));
    const beats = input.beats + this.beatOffset;
    const jumping = input.airborne + input.landing > 0.002;

    if (model.mixer) {
      if (model.walk) {
        model.walk.setEffectiveWeight(this.walkWeight);
        model.walk.timeScale = THREE.MathUtils.clamp(input.speed / 2.2, 0.6, 1.7);
      }
      model.idle?.setEffectiveWeight(1 - (model.walk ? this.walkWeight : 0));
      model.mixer.update(dt);
    }

    if (model.procedural) {
      let pose = heroIdlePose(input.elapsedSeconds, beats, this.offset);
      if (this.walkWeight > 0.002) pose = blendPose(pose, walkPose(input.stridePhase), this.walkWeight);
      if (this.danceWeight > 0.002 && this.lastDance) pose = blendPose(pose, this.styled(dancePose(this.lastDance, beats), input), this.danceWeight);
      if (jumping) pose = addPose(pose, jumpPose(input.airborne, input.landing));
      applyPose(model, pose, input.lite);
      this.blink(input.elapsedSeconds);
      return;
    }

    const dancing = this.danceWeight >= 0.002 && this.lastDance !== null;
    if (!dancing && !jumping) {
      model.root.position.set(0, 0, 0);
      model.root.rotation.set(0, 0, 0);
      return;
    }
    let pose = dancing ? scalePose(this.styled(dancePose(this.lastDance!, beats), input), this.danceWeight) : zeroPose();
    if (jumping) pose = addPose(pose, jumpPose(input.airborne, input.landing));
    applyPose(model, pose, input.lite);
  }

  private styled(pose: ReturnType<typeof dancePose>, input: AnimationInput): ReturnType<typeof dancePose> {
    const mirrored = input.mirrored ? mirrorPose(pose) : pose;
    return input.intensity < 1 ? scalePose(mirrored, input.intensity) : mirrored;
  }

  private blink(elapsedSeconds: number): void {
    if (elapsedSeconds > this.blinkAt) {
      this.blinkStart = elapsedSeconds;
      this.blinkAt = elapsedSeconds + 2.4 + Math.random() * 3;
    }
    const sinceBlink = elapsedSeconds - this.blinkStart;
    const closing = sinceBlink < 0.16 ? Math.sin((sinceBlink / 0.16) * Math.PI) : 0;
    const angle = lerp(-0.85, 1.5, THREE.MathUtils.clamp(0.08 + closing, 0, 1));
    for (const lid of this.model.eyelids) lid.rotation.x = angle;
  }
}
