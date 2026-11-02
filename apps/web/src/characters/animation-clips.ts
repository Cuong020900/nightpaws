import type { AnimationClipId, BoneName } from "@nightpaws/shared";

export type AnimatedBone = Exclude<BoneName, "root">;

export interface BoneRotation {
  x: number;
  y: number;
  z: number;
}

export interface CharacterPose {
  rotations: Record<AnimatedBone, BoneRotation>;
  hipsLift: number;
  bodyYaw: number;
}

export interface AnimationTiming {
  elapsedSeconds: number;
  beats: number;
  stridePhase: number;
}

export type AnimationClip = (pose: CharacterPose, timing: AnimationTiming) => void;

export const animatedBones: AnimatedBone[] = ["hips", "torso", "head", "armLeft", "armRight", "legLeft", "legRight", "tail"];

export function createRestPose(): CharacterPose {
  const rotations = {} as Record<AnimatedBone, BoneRotation>;
  for (const bone of animatedBones) rotations[bone] = { x: 0, y: 0, z: 0 };
  return { rotations, hipsLift: 0, bodyYaw: 0 };
}

const fullTurn = Math.PI * 2;

const idleBreathe: AnimationClip = (pose, { elapsedSeconds: t }) => {
  const breath = Math.sin(t * 2.2);
  const r = pose.rotations;
  r.torso.x = breath * 0.03;
  r.head.x = -breath * 0.03;
  r.head.y = Math.sin(t * 0.6) * 0.25;
  r.armLeft.z = 0.12 + breath * 0.04;
  r.armRight.z = -0.12 - breath * 0.04;
  r.tail.y = Math.sin(t * 1.5) * 0.3;
  pose.hipsLift = breath * 0.008;
};

const idleSway: AnimationClip = (pose, { elapsedSeconds: t }) => {
  const sway = Math.sin(t * 1.6);
  const r = pose.rotations;
  r.hips.z = sway * 0.04;
  r.torso.z = sway * 0.05;
  r.head.z = -sway * 0.06;
  r.head.y = Math.sin(t * 0.5) * 0.3;
  r.armLeft.z = 0.15 + sway * 0.05;
  r.armRight.z = -0.15 + sway * 0.05;
  r.legLeft.z = -sway * 0.04;
  r.legRight.z = -sway * 0.04;
  r.tail.y = sway * 0.5;
};

const walkWaddle: AnimationClip = (pose, { stridePhase: p }) => {
  const swing = Math.sin(p);
  const r = pose.rotations;
  r.legLeft.x = swing * 0.55;
  r.legRight.x = -swing * 0.55;
  r.armLeft.x = -swing * 0.45;
  r.armRight.x = swing * 0.45;
  r.armLeft.z = 0.2;
  r.armRight.z = -0.2;
  r.hips.z = swing * 0.1;
  r.torso.z = swing * 0.06;
  r.head.z = -swing * 0.06;
  r.tail.y = swing * 0.6;
  pose.hipsLift = Math.abs(Math.cos(p)) * 0.05;
};

const walkBounce: AnimationClip = (pose, { stridePhase: p }) => {
  const swing = Math.sin(p);
  const r = pose.rotations;
  r.legLeft.x = swing * 0.7;
  r.legRight.x = -swing * 0.7;
  r.armLeft.x = -swing * 0.6;
  r.armRight.x = swing * 0.6;
  r.armLeft.z = 0.15;
  r.armRight.z = -0.15;
  r.torso.x = 0.12;
  r.head.x = -0.08;
  r.tail.x = Math.sin(p * 2) * 0.2;
  pose.hipsLift = Math.abs(swing) * 0.1;
};

const danceBounce: AnimationClip = (pose, { beats: b }) => {
  const bounce = Math.abs(Math.sin(b * Math.PI));
  const pump = Math.sin(b * fullTurn);
  const r = pose.rotations;
  r.armLeft.z = 2.5 + pump * 0.35;
  r.armRight.z = -(2.5 - pump * 0.35);
  r.head.x = pump * 0.15;
  r.torso.x = -0.05 + bounce * 0.06;
  r.legLeft.z = 0.12;
  r.legRight.z = -0.12;
  r.tail.y = pump * 0.6;
  pose.hipsLift = bounce * 0.14;
};

const danceDisco: AnimationClip = (pose, { beats: b }) => {
  const point = (Math.sin(b * Math.PI) + 1) / 2;
  const groove = Math.sin(b * fullTurn);
  const r = pose.rotations;
  r.armRight.z = 0.4 - point * 3;
  r.armRight.x = -0.3;
  r.armLeft.z = 0.35;
  r.armLeft.x = -0.35;
  r.hips.z = groove * 0.15;
  r.torso.z = -groove * 0.1;
  r.head.z = groove * 0.1;
  r.legLeft.z = 0.1 + Math.max(0, groove) * 0.25;
  r.legRight.z = -0.1 - Math.max(0, -groove) * 0.25;
  r.tail.y = groove * 0.5;
  pose.bodyYaw = Math.sin(b * Math.PI) * 0.25;
  pose.hipsLift = Math.abs(Math.sin(b * fullTurn)) * 0.04;
};

const danceWave: AnimationClip = (pose, { beats: b }) => {
  const wave = Math.sin(b * fullTurn);
  const slow = Math.sin(b * Math.PI);
  const r = pose.rotations;
  r.armLeft.z = 1.45 + wave * 0.35;
  r.armRight.z = -(1.45 + Math.sin(b * fullTurn + Math.PI / 2) * 0.35);
  r.armLeft.x = wave * 0.2;
  r.armRight.x = -wave * 0.2;
  r.torso.z = slow * 0.12;
  r.head.z = -slow * 0.15;
  r.hips.z = -slow * 0.08;
  r.tail.y = slow * 0.7;
  pose.hipsLift = Math.abs(wave) * 0.05;
};

const danceSpin: AnimationClip = (pose, { beats: b }) => {
  const swing = Math.sin(b * fullTurn);
  const r = pose.rotations;
  r.armLeft.z = 2 + swing * 0.3;
  r.armRight.z = -(2 + swing * 0.3);
  r.legLeft.x = swing * 0.3;
  r.legRight.x = -swing * 0.3;
  r.head.x = -0.1;
  r.tail.y = swing * 0.8;
  pose.bodyYaw = ((b * Math.PI) / 2) % fullTurn;
  pose.hipsLift = Math.abs(Math.sin(b * Math.PI)) * 0.1;
};

export const animationClips: Record<AnimationClipId, AnimationClip> = {
  "idle-breathe": idleBreathe,
  "idle-sway": idleSway,
  "walk-waddle": walkWaddle,
  "walk-bounce": walkBounce,
  "dance-bounce": danceBounce,
  "dance-disco": danceDisco,
  "dance-wave": danceWave,
  "dance-spin": danceSpin,
};

export const danceDisplayNames: Record<AnimationClipId, string> = {
  "idle-breathe": "Breathe",
  "idle-sway": "Sway",
  "walk-waddle": "Waddle",
  "walk-bounce": "Bounce walk",
  "dance-bounce": "Hype",
  "dance-disco": "Disco",
  "dance-wave": "Wave",
  "dance-spin": "Spin",
};
