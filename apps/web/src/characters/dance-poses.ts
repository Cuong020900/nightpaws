import type { DanceMoveId } from "@nightpaws/shared";
import * as THREE from "three";
import type { CharacterModel } from "./character-model.ts";

export type PoseKey = DanceMoveId | "dj";

const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const squareWave = (x: number) => Math.tanh(3.5 * Math.sin(x)) / Math.tanh(3.5);

export interface Pose {
  y: number;
  d: number;
  px: number;
  ry: number;
  tw: number;
  ct: number;
  cp: number;
  cr: number;
  hx: number;
  hy: number;
  hz: number;
  aLr: number;
  aLs: number;
  aRr: number;
  aRs: number;
  eL: number;
  eR: number;
  fLu: number;
  fLf: number;
  fLs: number;
  fRu: number;
  fRf: number;
  fRs: number;
  wL: number;
  wR: number;
  gL: number;
  gR: number;
}

type PoseField = keyof Pose;

export function zeroPose(): Pose {
  return { y: 0, d: 0, px: 0, ry: 0, tw: 0, ct: 0, cp: 0, cr: 0, hx: 0, hy: 0, hz: 0, aLr: 0, aLs: 0, aRr: 0, aRs: 0, eL: 0, eR: 0, fLu: 0, fLf: 0, fLs: 0, fRu: 0, fRf: 0, fRs: 0, wL: 0, wR: 0, gL: 0, gR: 0 };
}

const poseFields = Object.keys(zeroPose()) as PoseField[];

export function scalePose(pose: Pose, weight: number): Pose {
  const result = zeroPose();
  for (const field of poseFields) result[field] = pose[field] * weight;
  return result;
}

export function blendPose(from: Pose, to: Pose, weight: number): Pose {
  const result = zeroPose();
  for (const field of poseFields) result[field] = lerp(from[field], to[field], weight);
  return result;
}

export function addPose(base: Pose, delta: Pose): Pose {
  const result = zeroPose();
  for (const field of poseFields) result[field] = base[field] + delta[field];
  return result;
}

export function mirrorPose(pose: Pose): Pose {
  const result = { ...pose };
  for (const field of ["px", "ry", "tw", "ct", "cr", "hy", "hz"] as const) result[field] = -pose[field];
  result.aLr = pose.aRr;
  result.aRr = pose.aLr;
  result.aLs = pose.aRs;
  result.aRs = pose.aLs;
  result.eL = pose.eR;
  result.eR = pose.eL;
  result.fLu = pose.fRu;
  result.fRu = pose.fLu;
  result.fLf = pose.fRf;
  result.fRf = pose.fLf;
  result.fLs = -pose.fRs;
  result.fRs = -pose.fLs;
  result.wL = pose.wR;
  result.wR = pose.wL;
  result.gL = pose.gR;
  result.gR = pose.gL;
  return result;
}

const robotFrames = [
  [0.15, 1.5, 1.55, 0.15, 1.5, 1.55, 0, 0, 0.04],
  [1.55, 0, 1.55, 0.15, 1.5, 1.55, 0.45, 0.25, 0.04],
  [1.55, 0, 1.55, 1.55, 0, 1.55, 0, 0, 0.1],
  [1.55, 0, 0, 1.55, 0, 0, -0.3, -0.2, 0.06],
  [0.2, 1.5, 0.1, 2.9, 0.2, 0.1, 0.4, 0.2, 0.04],
  [2.9, 0.2, 0.1, 0.2, 1.5, 0.1, -0.4, -0.2, 0.04],
  [0.3, 0.6, 2.2, 0.3, 0.6, 2.2, 0, 0, 0.14],
  [1.2, 0.8, 1.9, 1.2, 0.8, 1.9, 0, 0, 0.02],
];

const hitFrames = [
  [2.8, 0.1, 0.2, 0.4, 0.4, 1.2],
  [1.55, 0, 0.1, 1.55, 0, 0.1],
  [0.4, 1.3, 2.1, 0.4, 1.3, 2.1],
  [0.3, 0.9, 0.6, 2.9, 0.1, 0.2],
];

function blendFrames(frames: number[][], index: number, amount: number): number[] {
  const from = frames[(index + frames.length - 1) % frames.length]!;
  const to = frames[index % frames.length]!;
  return from.map((value, i) => lerp(value, to[i]!, amount));
}

const beatParity = (beats: number) => ((Math.floor(beats) % 2) + 2) % 2;

function wristRollPose(beats: number): Pose {
  const P = zeroPose();
  const ph = beats * TAU;
  const sway = Math.sin(ph / 2);
  const groove = Math.pow(0.5 + 0.5 * Math.cos(ph), 1.5);
  P.d = 0.03 + 0.09 * groove;
  P.px = 0.12 * sway;
  P.cr = -0.08 * sway;
  P.tw = 0.16 * sway;
  P.ct = 0.1 * Math.sin(ph / 2 + 0.6);
  P.cp = 0.04 * groove - 0.03;
  P.hx = -0.07 + 0.12 * groove;
  P.hy = 0.18 * Math.sin(ph / 4);
  P.hz = 0.08 * sway;
  P.fLu = 0.05 * Math.max(0, -sway);
  P.fRu = 0.05 * Math.max(0, sway);
  const roll = ph * 2;
  const rollL = roll;
  const rollR = roll + Math.PI;
  P.aLs = 0.85 + 0.22 * Math.sin(rollL);
  P.aRs = 0.85 + 0.22 * Math.sin(rollR);
  P.aLr = 0.02 + 0.14 * Math.cos(rollL);
  P.aRr = 0.02 + 0.14 * Math.cos(rollR);
  P.eL = 1.75 + 0.32 * Math.cos(rollL);
  P.eR = 1.75 + 0.32 * Math.cos(rollR);
  P.wL = 0.95 * Math.sin(rollL + 0.9);
  P.wR = 0.95 * Math.sin(rollR + 0.9);
  P.gL = 0.4 + 0.35 * Math.sin(rollL * 2);
  P.gR = 0.4 + 0.35 * Math.sin(rollR * 2);
  return P;
}

function woahPose(beats: number): Pose {
  const P = zeroPose();
  const t = fract(beats);
  const hit = ease(t * 7) * (1 - ease((t - 0.62) * 3));
  P.d = 0.03 + 0.12 * hit;
  P.cr = 0.17 * hit;
  P.tw = 0.24 * hit;
  P.ry = 0.12 * hit;
  P.px = -0.06 * hit;
  P.hx = 0.2 * hit - 0.04;
  P.hy = 0.38 * hit;
  P.aLr = lerp(0.3, 0.55, hit);
  P.aLs = lerp(0.35, 1.0, hit);
  P.eL = lerp(1.2, 2.15, hit);
  P.aRr = lerp(0.3, -0.08, hit);
  P.aRs = lerp(0.35, 0.8, hit);
  P.eR = lerp(1.2, 1.95, hit);
  P.wL = 0.4 * hit;
  P.wR = -0.3 * hit;
  P.gL = P.gR = 0.35 + 0.65 * hit;
  P.fRu = 0.05 * hit;
  P.fRs = -0.04 * hit;
  return beatParity(beats) === 0 ? P : mirrorPose(P);
}

function shootPose(beats: number): Pose {
  const P = zeroPose();
  const t = fract(beats / 2) * 2;
  const knee = ease(t * 3) * (1 - ease((t - 0.85) * 3));
  const kick = ease((t - 0.3) * 4) * (1 - ease((t - 1.05) * 3));
  const guard = ease(t * 4) * (1 - ease((t - 1.3) * 2.5));
  const land = Math.pow(Math.max(0, Math.cos(beats * TAU)), 2);
  P.fLu = 0.28 * knee * (1 - 0.4 * kick);
  P.fLf = 0.2 * kick;
  P.fLs = 0.14 * kick;
  P.aLr = lerp(lerp(0.3, 0.4, guard), 0.8, kick);
  P.aLs = lerp(lerp(0.4, 0.55, guard), 0.95, kick);
  P.eL = lerp(lerp(1.4, 1.75, guard), 0.1, kick);
  P.aRr = lerp(0.3, 0.05, guard);
  P.aRs = lerp(0.4, 0.75, guard);
  P.eR = lerp(1.4, 2.0, guard);
  P.gL = P.gR = 0.4 + 0.6 * guard;
  P.wL = -0.5 * kick;
  P.cp = -0.12 * kick + 0.04 * knee;
  P.ct = 0.24 * kick;
  P.tw = 0.12 * kick - 0.06 * knee;
  P.cr = -0.06 * kick;
  P.px = -0.05 * guard;
  P.hx = 0.12 * kick + 0.08 * land - 0.04;
  P.hy = 0.25 * kick;
  P.d = 0.04 + 0.06 * land * (1 - knee);
  return fract(beats / 4) < 0.5 ? P : mirrorPose(P);
}

function gangnamPose(beats: number): Pose {
  const P = zeroPose();
  const ph = beats * TAU;
  const hop = Math.abs(Math.sin(ph));
  const side = squareWave(ph / 2);
  const freeR = Math.max(0, side);
  const freeL = Math.max(0, -side);
  const bar = ((beats % 8) + 8) % 8;
  const lasso = ease((bar - 3.75) * 4) * (1 - ease((bar - 7.75) * 4));
  const swirl = ph * 2;
  P.y = 0.035 * hop;
  P.d = 0.04 + 0.06 * (1 - hop);
  P.px = 0.07 * side;
  P.tw = 0.08 * side;
  P.ct = 0.06 * side;
  P.cr = -0.05 * side;
  P.cp = -0.05;
  P.hx = 0.1 * hop - 0.04 - 0.12 * lasso;
  P.hy = 0.1 * Math.sin(ph / 4);
  P.fRu = 0.11 * hop * freeR;
  P.fRs = 0.05 * freeR;
  P.fRf = 0.03 * freeR;
  P.fLu = 0.11 * hop * freeL;
  P.fLs = -0.05 * freeL;
  P.fLf = 0.03 * freeL;
  const reinsSwing = 0.55 + 0.08 * hop;
  P.aLs = lerp(reinsSwing, 0.7, lasso);
  P.aLr = lerp(-0.85, -0.45, lasso);
  P.eL = lerp(1.5, 1.2, lasso);
  P.wL = 0.3;
  P.aRs = lerp(reinsSwing, 0.5 + 0.25 * Math.sin(swirl), lasso);
  P.aRr = lerp(-0.85, 2.3 + 0.2 * Math.cos(swirl), lasso);
  P.eR = lerp(1.5, 0.75, lasso);
  P.wR = lerp(0.3, 1.1 * Math.sin(swirl), lasso);
  P.gL = 0.9;
  P.gR = lerp(0.9, 0.7, lasso);
  return fract(beats / 16) < 0.5 ? P : mirrorPose(P);
}

export function jumpPose(airborne: number, squash: number): Pose {
  const P = zeroPose();
  P.fLu = P.fRu = 0.14 * airborne;
  P.fLf = 0.05 * airborne;
  P.fRf = -0.03 * airborne;
  P.aLr = P.aRr = 1.1 * airborne;
  P.aLs = P.aRs = 0.35 * airborne;
  P.eL = P.eR = 0.5 * airborne + 0.4 * squash;
  P.hx = -0.1 * airborne + 0.12 * squash;
  P.cp = 0.1 * squash;
  P.d = 0.1 * squash;
  return P;
}

export function dancePose(key: PoseKey, beats: number): Pose {
  const P = zeroPose();
  const ph = beats * TAU;
  const s2 = Math.sin(ph / 2);
  const cb = Math.cos(ph);
  switch (key) {
    case "bounce":
      P.d = 0.09 * Math.pow(Math.max(0, cb), 2) + 0.02;
      P.aRr = 0.35 + 2.2 * Math.max(0, s2);
      P.aRs = 0.3;
      P.eR = 1.3 - 1.0 * Math.max(0, s2);
      P.aLr = 0.35 + 2.2 * Math.max(0, -s2);
      P.aLs = 0.3;
      P.eL = 1.3 - 1.0 * Math.max(0, -s2);
      P.hx = 0.16 * Math.max(0, cb);
      P.cr = 0.06 * s2;
      P.tw = 0.18 * s2;
      P.ct = -0.08 * s2;
      break;
    case "twostep": {
      const s = squareWave(ph / 2);
      const tap = Math.pow(Math.max(0, Math.sin(ph)), 2);
      P.px = 0.13 * s;
      P.d = 0.05 * Math.pow(Math.max(0, cb), 2) + 0.02;
      if (s > 0) {
        P.fRu = 0.09 * tap;
        P.fRs = 0.06 * tap;
      } else {
        P.fLu = 0.09 * tap;
        P.fLs = -0.06 * tap;
      }
      P.aLs = 0.45 * s;
      P.aRs = -0.45 * s;
      P.eL = P.eR = 1.15;
      P.aLr = P.aRr = 0.22;
      P.cr = -0.08 * s;
      P.ct = 0.22 * s;
      P.hx = 0.08 * Math.max(0, cb);
      P.hz = 0.06 * s;
      break;
    }
    case "shuffle": {
      const kL = Math.max(0, Math.sin(ph));
      const kR = Math.max(0, -Math.sin(ph));
      P.fLu = 0.24 * kL;
      P.fLf = 0.12 * kL - 0.1 * kR;
      P.fRu = 0.24 * kR;
      P.fRf = 0.12 * kR - 0.1 * kL;
      P.d = 0.08 + 0.03 * Math.abs(cb);
      P.aRs = 0.9 * (kL - kR);
      P.aLs = 0.9 * (kR - kL);
      P.eL = P.eR = 1.45;
      P.aLr = P.aRr = 0.2;
      P.ct = 0.25 * (kL - kR);
      P.hx = 0.1 * Math.abs(Math.sin(ph));
      P.cp = 0.08;
      break;
    }
    case "robot": {
      const index = Math.floor(beats * 2) % robotFrames.length;
      const values = blendFrames(robotFrames, index, ease(fract(beats * 2) * 7));
      [P.aLr, P.aLs, P.eL, P.aRr, P.aRs, P.eR, P.hy, P.ct, P.d] = values as [number, number, number, number, number, number, number, number, number];
      const snap = Math.pow(1 - fract(beats * 2), 5);
      P.hx = 0.07 * snap;
      P.d += 0.03 * snap;
      break;
    }
    case "point": {
      const q = (squareWave(ph / 4) + 1) / 2;
      P.aRr = lerp(0.75, 2.55, q);
      P.aRs = lerp(1.0, 0.25, q);
      P.eR = 0.05;
      P.aLr = 0.6;
      P.aLs = -0.35;
      P.eL = 1.8;
      P.tw = 0.3 * s2;
      P.px = 0.1 * s2;
      P.cr = -0.1 * s2;
      P.d = 0.05 * Math.pow(Math.max(0, cb), 2) + 0.02;
      P.hy = lerp(0.35, -0.2, q);
      P.hx = lerp(0.2, -0.2, q);
      P.fLu = 0.06 * Math.max(0, s2);
      P.fRu = 0.06 * Math.max(0, -s2);
      break;
    }
    case "handsup":
      P.aLr = 2.65 + 0.25 * Math.sin(ph);
      P.aRr = 2.65 - 0.25 * Math.sin(ph);
      P.eL = P.eR = 0.4;
      P.aLs = P.aRs = 0.15;
      P.px = 0.1 * s2;
      P.cr = 0.1 * s2;
      P.tw = 0.15 * s2;
      P.d = 0.07 * (0.5 - 0.5 * cb);
      P.hx = -0.12 + 0.06 * Math.sin(ph);
      break;
    case "roll": {
      const bar = ((beats % 8) + 8) % 8;
      if (bar < 4) {
        P.cp = 0.2 * Math.sin(ph);
        P.d = 0.14 * (0.5 - 0.5 * cb);
        P.hx = 0.16 * Math.sin(ph + 1);
        P.aLs = P.aRs = 0.45;
        P.eL = P.eR = 1.1;
        P.aLr = P.aRr = 0.3;
        P.px = 0.05 * s2;
      } else {
        const index = Math.floor(bar - 4);
        const values = blendFrames(hitFrames, index, ease(fract(beats) * 6));
        [P.aLr, P.aLs, P.eL, P.aRr, P.aRs, P.eR] = values as [number, number, number, number, number, number];
        const hit = Math.pow(1 - fract(beats), 4);
        P.d = 0.08 * hit + 0.04;
        P.hx = 0.1 * hit;
        P.ct = [0.2, 0, 0, -0.2][index] ?? 0;
      }
      break;
    }
    case "hype": {
      const t = fract(beats);
      const air = Math.sin(t * Math.PI);
      P.y = 0.2 * air;
      P.d = 0.1 * Math.pow(1 - t, 6) + 0.05 * Math.pow(t, 6);
      P.aRr = 2.75;
      P.eR = 0.3 + 0.4 * (1 - air);
      P.aRs = 0.1 + 0.25 * air;
      P.aLr = 0.45;
      P.aLs = 0.4;
      P.eL = 1.3;
      P.fLu = P.fRu = 0.1 * air;
      P.fLf = P.fRf = 0.04 * air;
      P.hx = -0.1 * air + 0.12 * Math.pow(1 - t, 6);
      break;
    }
    case "wristroll":
      return wristRollPose(beats);
    case "woah":
      return woahPose(beats);
    case "shoot":
      return shootPose(beats);
    case "gangnam":
      return gangnamPose(beats);
    case "runningman": {
      const step = ph / 2;
      const liftL = Math.max(0, Math.sin(step));
      const liftR = Math.max(0, -Math.sin(step));
      const stride = Math.cos(step);
      P.fLu = 0.3 * Math.pow(liftL, 1.2);
      P.fRu = 0.3 * Math.pow(liftR, 1.2);
      P.fLf = -0.18 * stride + 0.06 * liftL;
      P.fRf = 0.18 * stride + 0.06 * liftR;
      P.d = 0.07 + 0.08 * Math.pow(Math.abs(stride), 3);
      P.aLs = 0.85 * stride;
      P.aRs = -0.85 * stride;
      P.aLr = P.aRr = 0.3;
      P.eL = P.eR = 1.6;
      P.gL = P.gR = 0.85;
      P.cp = 0.12;
      P.tw = 0.1 * stride;
      P.ct = -0.14 * stride;
      P.hx = 0.08 * Math.pow(Math.abs(stride), 3) - 0.02;
      P.hz = 0.04 * stride;
      break;
    }
    case "dougie": {
      const sway = Math.sin(ph / 2);
      const lean = squareWave(ph / 2);
      const brushL = Math.pow(Math.max(0, -sway), 1.5);
      const brushR = Math.pow(Math.max(0, sway), 1.5);
      const tap = Math.pow(Math.max(0, Math.sin(ph)), 2);
      P.px = 0.11 * lean;
      P.cr = 0.13 * lean;
      P.tw = 0.22 * sway;
      P.ct = 0.12 * sway;
      P.cp = -0.09;
      P.d = 0.04 + 0.05 * Math.pow(Math.max(0, cb), 2);
      P.aRr = lerp(0.45, 2.3, brushR);
      P.aRs = lerp(0.3 + 0.45 * brushL, 0.35, brushR);
      P.eR = lerp(1.2, 1.0, brushR);
      P.aLr = lerp(0.45, 2.3, brushL);
      P.aLs = lerp(0.3 + 0.45 * brushR, 0.35, brushL);
      P.eL = lerp(1.2, 1.0, brushL);
      P.wL = 0.6 * brushL;
      P.wR = 0.6 * brushR;
      P.gL = P.gR = 0.3;
      P.hz = -0.12 * lean;
      P.hx = -0.1 + 0.1 * Math.pow(Math.max(0, cb), 2);
      P.hy = -0.15 * sway;
      if (lean > 0) P.fRu = 0.05 * tap;
      else P.fLu = 0.05 * tap;
      break;
    }
    case "floss": {
      const hips = Math.sin(ph);
      P.px = 0.1 * hips;
      P.cr = -0.07 * hips;
      P.tw = 0.12 * hips;
      P.d = 0.03 + 0.03 * Math.abs(cb);
      P.aLr = 0.4 - 0.7 * hips;
      P.aRr = 0.4 + 0.7 * hips;
      P.aLs = 0.2 + 0.85 * hips;
      P.aRs = 0.2 - 0.85 * hips;
      P.eL = P.eR = 0.15;
      P.gL = P.gR = 0.9;
      P.hx = 0.07 * Math.abs(hips) - 0.02;
      P.hz = 0.06 * hips;
      P.fLu = 0.03 * Math.max(0, -hips);
      P.fRu = 0.03 * Math.max(0, hips);
      break;
    }
    case "millyrock": {
      const rock = Math.sin(ph / 2);
      const drift = Math.cos(ph / 2);
      const upL = Math.max(0, rock);
      const upR = Math.max(0, -rock);
      P.px = 0.13 * rock;
      P.tw = 0.26 * rock;
      P.cr = -0.09 * rock;
      P.ct = 0.08 * rock;
      P.hz = 0.09 * rock;
      P.hy = 0.22 * rock;
      P.hx = 0.06 * Math.pow(Math.max(0, cb), 2) - 0.03;
      P.d = 0.05 + 0.05 * Math.pow(Math.max(0, cb), 2);
      P.fRu = 0.07 * Math.max(0, drift) * Math.abs(Math.sin(ph));
      P.fLu = 0.07 * Math.max(0, -drift) * Math.abs(Math.sin(ph));
      P.aLr = 0.35 + 1.4 * upL - 0.4 * upR;
      P.aLs = 0.5 + 0.35 * upR;
      P.eL = 1.3 - 0.55 * upL + 0.5 * upR;
      P.aRr = 0.35 + 1.4 * upR - 0.4 * upL;
      P.aRs = 0.5 + 0.35 * upL;
      P.eR = 1.3 - 0.55 * upR + 0.5 * upL;
      P.wL = 0.5 * upL - 0.3 * upR;
      P.wR = 0.5 * upR - 0.3 * upL;
      P.gL = P.gR = 0.5;
      break;
    }
    case "dj": {
      const bar = ((beats % 8) + 8) % 8;
      const hype = ease((bar - 5.5) * 2) * (1 - ease((bar - 7.6) * 4));
      P.hx = 0.05 + 0.22 * Math.pow(Math.max(0, Math.sin(ph)), 2);
      P.d = 0.05 * (0.5 - 0.5 * cb);
      P.aRs = 0.95;
      P.aRr = 0.12 + 0.08 * Math.sin(ph * 4);
      P.eR = 0.75;
      P.aLs = lerp(0.85, 0.1, hype);
      P.aLr = lerp(0.1, 2.75 + 0.15 * Math.sin(ph * 2), hype);
      P.eL = lerp(0.8, 0.2, hype);
      P.cr = 0.05 * s2;
      P.hz = 0.08 * s2;
      P.cp = 0.08;
      break;
    }
  }
  return P;
}

export function heroIdlePose(elapsedSeconds: number, beats: number, offset: number): Pose {
  const I = zeroPose();
  const ph = beats * TAU;
  I.cr = 0.03 * Math.sin(elapsedSeconds * 0.6 + offset);
  I.ct = 0.05 * Math.sin(elapsedSeconds * 0.6 + offset);
  I.cp = 0.02 * Math.sin(elapsedSeconds * 1.7);
  I.hy = 0.28 * Math.sin(elapsedSeconds * 0.33 + offset) + 0.06 * Math.sin(elapsedSeconds * 0.9);
  I.hx = 0.04 * Math.max(0, Math.sin(ph)) - 0.02;
  I.hz = -0.6 * I.cr;
  I.aLs = I.aRs = 0.45;
  I.aLr = I.aRr = -0.18;
  I.eL = I.eR = 1.15;
  I.d = 0.015 * (0.5 - 0.5 * Math.cos(ph));
  return I;
}

export function walkPose(stridePhase: number): Pose {
  const P = zeroPose();
  const swing = Math.sin(stridePhase);
  const lift = Math.cos(stridePhase);
  P.fLf = 0.16 * swing;
  P.fRf = -0.16 * swing;
  P.fLu = 0.1 * Math.max(0, lift);
  P.fRu = 0.1 * Math.max(0, -lift);
  P.aLs = -0.5 * swing;
  P.aRs = 0.5 * swing;
  P.aLr = P.aRr = 0.1;
  P.eL = P.eR = 0.5;
  P.tw = 0.1 * swing;
  P.cr = 0.04 * swing;
  P.cp = 0.05;
  P.d = 0.03 * Math.abs(lift);
  return P;
}

const UP = new THREE.Vector3(0, 1, 0);
const axisX = new THREE.Vector3();
const axisF = new THREE.Vector3();
const rootQuaternion = new THREE.Quaternion();
const turn = new THREE.Quaternion();
const worldQ = new THREE.Quaternion();
const parentQ = new THREE.Quaternion();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const d = new THREE.Vector3();

function rotateWorld(bone: THREE.Object3D | undefined, axis: THREE.Vector3, angle: number): void {
  if (!bone || !angle || !bone.parent) return;
  turn.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(worldQ);
  bone.parent.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(turn.multiply(worldQ)));
  bone.updateMatrixWorld(true);
}

function rotateWorldBy(bone: THREE.Object3D, rotation: THREE.Quaternion): void {
  if (!bone.parent) return;
  bone.getWorldQuaternion(worldQ);
  bone.parent.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(rotation.multiply(worldQ)));
  bone.updateMatrixWorld(true);
}

const fingerChains = ["Index", "Middle", "Pinky"] as const;
const localCurl = new THREE.Quaternion();
const curlAxis = new THREE.Vector3(1, 0, 0);

function curlFingers(bones: Record<string, THREE.Object3D>, side: "L" | "R", curl: number): void {
  for (const finger of fingerChains) {
    for (const segment of [1, 2, 3]) {
      const bone = bones[`${finger}${segment}.${side}`];
      if (!bone) continue;
      bone.quaternion.multiply(localCurl.setFromAxisAngle(curlAxis, curl * 0.6));
    }
  }
  const thumb = bones[`Thumb1.${side}`];
  if (thumb) thumb.quaternion.multiply(localCurl.setFromAxisAngle(curlAxis, curl * 0.3));
}

export function applyPose(model: CharacterModel, P: Pose, lite: boolean): void {
  const bones = model.bones;
  const root = model.root;
  const k = model.size;
  const sideL = model.sideL;
  root.position.set(0, P.y * k, 0);
  root.rotation.set(0, P.ry, 0);
  root.updateMatrixWorld(true);
  root.getWorldQuaternion(rootQuaternion);
  axisX.set(1, 0, 0).applyQuaternion(rootQuaternion);
  axisF.set(0, 0, 1).applyQuaternion(rootQuaternion);
  const X = axisX;
  const F = axisF;

  const feet: Partial<Record<"L" | "R", { world: THREE.Vector3; ankleLocal: THREE.Vector3 }>> = {};
  if (!lite) {
    for (const side of ["L", "R"] as const) {
      const foot = bones[`Foot.${side}`];
      const lowerLeg = bones[`LowerLeg.${side}`];
      if (!foot || !lowerLeg) continue;
      const world = foot.getWorldPosition(new THREE.Vector3());
      feet[side] = { world, ankleLocal: lowerLeg.worldToLocal(world.clone()) };
    }
  }
  const drop = lite ? 0 : P.d;
  const shift = lite ? 0 : P.px;
  const body = bones.Body;
  if (body?.parent && (drop || shift)) {
    const position = body.getWorldPosition(a);
    position.addScaledVector(X, shift * k * sideL).addScaledVector(UP, -drop * k);
    body.position.copy(body.parent.worldToLocal(position));
    body.updateMatrixWorld(true);
  }
  rotateWorld(bones.Hips, UP, P.tw);
  rotateWorld(bones.Abdomen, X, P.cp * 0.5 * sideL);
  rotateWorld(bones.Torso, X, P.cp * 0.5 * sideL);
  rotateWorld(bones.Torso, F, P.cr);
  rotateWorld(bones.Torso, UP, P.ct);
  rotateWorld(bones.Head, X, P.hx * sideL);
  rotateWorld(bones.Head, UP, P.hy);
  rotateWorld(bones.Head, F, P.hz);

  for (const side of ["L", "R"] as const) {
    const upperArm = bones[`UpperArm.${side}`];
    const lowerArm = bones[`LowerArm.${side}`];
    if (!upperArm || !lowerArm) continue;
    const sign = side === "L" ? sideL : -sideL;
    const raise = side === "L" ? P.aLr : P.aRr;
    const swing = side === "L" ? P.aLs : P.aRs;
    const elbow = side === "L" ? P.eL : P.eR;
    const twist = side === "L" ? P.wL : P.wR;
    const curl = side === "L" ? P.gL : P.gR;
    rotateWorld(upperArm, X, -swing * sideL);
    rotateWorld(upperArm, F, sign * raise);
    upperArm.getWorldPosition(a);
    lowerArm.getWorldPosition(b);
    c.subVectors(b, a).normalize();
    if (elbow) {
      d.crossVectors(c, F);
      if (d.lengthSq() < 1e-4) d.copy(X).multiplyScalar(sign);
      d.normalize();
      rotateWorld(lowerArm, d, elbow * sideL);
      c.applyAxisAngle(d, elbow * sideL);
    }
    if (curl && !lite) curlFingers(bones, side, curl);
    if (twist) rotateWorld(lowerArm, c, sign * twist);
  }

  if (lite) return;
  for (const side of ["L", "R"] as const) {
    const upperLeg = bones[`UpperLeg.${side}`];
    const lowerLeg = bones[`LowerLeg.${side}`];
    const foot = bones[`Foot.${side}`];
    const planted = feet[side];
    if (!upperLeg || !lowerLeg || !foot?.parent || !planted) continue;
    const lift = side === "L" ? P.fLu : P.fRu;
    const forward = side === "L" ? P.fLf : P.fRf;
    const sideways = side === "L" ? P.fLs : P.fRs;
    const target = planted.world.clone().addScaledVector(UP, lift * k).addScaledVector(F, forward * k).addScaledVector(X, sideways * k * sideL);
    const hip = upperLeg.getWorldPosition(new THREE.Vector3());
    const knee = lowerLeg.getWorldPosition(new THREE.Vector3());
    const ankle = lowerLeg.localToWorld(planted.ankleLocal.clone());
    const thigh = knee.distanceTo(hip);
    const shin = ankle.distanceTo(knee);
    const toTarget = target.clone().sub(hip);
    const distance = clamp(toTarget.length(), 0.01, (thigh + shin) * 0.999);
    const direction = toTarget.normalize();
    const bend = Math.acos(clamp((thigh * thigh + distance * distance - shin * shin) / (2 * thigh * distance), -1, 1));
    const normal = new THREE.Vector3().crossVectors(direction, F);
    if (normal.lengthSq() < 1e-6) normal.copy(X);
    normal.normalize();
    const kneeDirection = direction.clone().applyAxisAngle(normal, bend);
    const currentThigh = knee.clone().sub(hip).normalize();
    rotateWorldBy(upperLeg, new THREE.Quaternion().setFromUnitVectors(currentThigh, kneeDirection));
    const knee2 = lowerLeg.getWorldPosition(new THREE.Vector3());
    const ankle2 = lowerLeg.localToWorld(planted.ankleLocal.clone());
    const currentShin = ankle2.sub(knee2).normalize();
    const wantedShin = target.clone().sub(knee2).normalize();
    rotateWorldBy(lowerLeg, new THREE.Quaternion().setFromUnitVectors(currentShin, wantedShin));
    if (lift || forward || sideways) {
      foot.position.copy(foot.parent.worldToLocal(target.clone()));
      foot.updateMatrixWorld(true);
    }
  }
}
