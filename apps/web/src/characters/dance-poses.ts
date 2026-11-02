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
}

type PoseField = keyof Pose;

export function zeroPose(): Pose {
  return { y: 0, d: 0, px: 0, ry: 0, tw: 0, ct: 0, cp: 0, cr: 0, hx: 0, hy: 0, hz: 0, aLr: 0, aLs: 0, aRr: 0, aRs: 0, eL: 0, eR: 0, fLu: 0, fLf: 0, fLs: 0, fRu: 0, fRf: 0, fRs: 0 };
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
    rotateWorld(upperArm, X, -swing * sideL);
    rotateWorld(upperArm, F, sign * raise);
    if (elbow) {
      upperArm.getWorldPosition(a);
      lowerArm.getWorldPosition(b);
      c.subVectors(b, a).normalize();
      d.crossVectors(c, F);
      if (d.lengthSq() < 1e-4) d.copy(X).multiplyScalar(sign);
      d.normalize();
      rotateWorld(lowerArm, d, elbow * sideL);
    }
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
