import type { AnimationClipId } from "@nightpaws/shared";
import * as THREE from "three";
import {
  animatedBones,
  animationClips,
  createRestPose,
  type AnimationTiming,
  type CharacterPose,
} from "./animation-clips.ts";
import type { CharacterRig } from "./character-rig.ts";

const defaultBlendSeconds = 0.25;

function copyPose(source: CharacterPose, target: CharacterPose): void {
  for (const bone of animatedBones) {
    const from = source.rotations[bone];
    const to = target.rotations[bone];
    to.x = from.x;
    to.y = from.y;
    to.z = from.z;
  }
  target.hipsLift = source.hipsLift;
  target.bodyYaw = source.bodyYaw;
}

function resetPose(pose: CharacterPose): void {
  for (const bone of animatedBones) {
    const rotation = pose.rotations[bone];
    rotation.x = 0;
    rotation.y = 0;
    rotation.z = 0;
  }
  pose.hipsLift = 0;
  pose.bodyYaw = 0;
}

function shortestAngleLerp(from: number, to: number, amount: number): number {
  const delta = THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
  return from + delta * amount;
}

export class CharacterAnimator {
  private clipId: AnimationClipId;
  private readonly blendFromPose = createRestPose();
  private readonly targetPose = createRestPose();
  private readonly appliedPose = createRestPose();
  private blendElapsed = 0;
  private blendDuration = 0;

  constructor(
    private readonly rig: CharacterRig,
    initialClip: AnimationClipId,
  ) {
    this.clipId = initialClip;
  }

  get currentClip(): AnimationClipId {
    return this.clipId;
  }

  play(clipId: AnimationClipId, blendSeconds = defaultBlendSeconds): void {
    if (clipId === this.clipId) return;
    copyPose(this.appliedPose, this.blendFromPose);
    this.clipId = clipId;
    this.blendElapsed = 0;
    this.blendDuration = blendSeconds;
  }

  update(deltaSeconds: number, timing: AnimationTiming): void {
    resetPose(this.targetPose);
    animationClips[this.clipId](this.targetPose, timing);

    this.blendElapsed += deltaSeconds;
    const blend = this.blendDuration > 0 ? THREE.MathUtils.smoothstep(this.blendElapsed / this.blendDuration, 0, 1) : 1;

    for (const bone of animatedBones) {
      const from = this.blendFromPose.rotations[bone];
      const to = this.targetPose.rotations[bone];
      const applied = this.appliedPose.rotations[bone];
      applied.x = THREE.MathUtils.lerp(from.x, to.x, blend);
      applied.y = THREE.MathUtils.lerp(from.y, to.y, blend);
      applied.z = THREE.MathUtils.lerp(from.z, to.z, blend);
      this.rig.bones[bone].rotation.set(applied.x, applied.y, applied.z);
    }
    this.appliedPose.hipsLift = THREE.MathUtils.lerp(this.blendFromPose.hipsLift, this.targetPose.hipsLift, blend);
    this.appliedPose.bodyYaw = shortestAngleLerp(this.blendFromPose.bodyYaw, this.targetPose.bodyYaw, blend);

    this.rig.bones.hips.position.y = this.rig.proportions.hipHeight + this.appliedPose.hipsLift;
    this.rig.bones.root.rotation.y = this.appliedPose.bodyYaw;
  }
}
