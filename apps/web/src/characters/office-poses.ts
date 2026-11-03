import * as THREE from "three";
import { zeroPose, type Pose } from "./dance-poses.ts";

export type OfficePoseKey = "typing" | "pouring" | "holding" | "sipping" | "talking" | "listening";

const lerp = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;
export const sipPeriod = 3.4;

export function sipLift(seconds: number): number {
  const t = THREE.MathUtils.euclideanModulo(seconds, sipPeriod) / sipPeriod;
  return smooth(t, 0.08, 0.3) * (1 - smooth(t, 0.62, 0.84));
}

function holdCup(P: Pose, lift: number): void {
  P.aRs = lerp(1.2, 1.8, lift);
  P.aRr = lerp(-0.8, 1.2, lift);
  P.eR = lerp(1.2, 1.0, lift);
  P.gR = 0.85;
  P.hx = lerp(P.hx, -0.18, lift);
  P.hy = lerp(P.hy, -0.2, lift);
}

function restLeftArm(P: Pose, seconds: number): void {
  P.aLs = 0.12 + 0.04 * Math.sin(seconds * 0.9);
  P.aLr = -0.28;
  P.eL = 0.35;
}

export function officePose(key: OfficePoseKey, seconds: number, offset: number, holding: boolean): Pose {
  const P = zeroPose();
  const t = seconds + offset * 7;
  switch (key) {
    case "typing": {
      const burst = smooth(Math.sin(t * 0.42) + 0.45 * Math.sin(t * 1.27 + 1), -0.35, 0.25);
      const tapL = Math.pow(Math.max(0, Math.sin(t * 19)), 3) * burst;
      const tapR = Math.pow(Math.max(0, Math.sin(t * 16.3 + 1.7)), 3) * burst;
      P.cp = 0.05 + 0.12 * burst;
      P.hx = lerp(-0.1, 0.2, burst);
      P.hy = (1 - burst) * 0.22 * Math.sin(t * 0.37 + offset);
      P.hz = 0.04 * Math.sin(t * 0.8);
      P.aLs = P.aRs = 0.98;
      P.aLr = P.aRr = -0.62;
      P.eL = 0.6 + 0.25 * tapL;
      P.eR = 0.6 + 0.25 * tapR;
      P.wL = 0.15 * tapL;
      P.wR = 0.15 * tapR;
      P.gL = P.gR = 0.3;
      P.ct = 0.05 * Math.sin(t * 0.6);
      break;
    }
    case "pouring": {
      const press = smooth(Math.sin(t * 1.6), -0.2, 0.6);
      P.cp = 0.1;
      P.hx = 0.28;
      P.aRs = 0.95;
      P.aRr = -0.35;
      P.eR = 0.75 - 0.15 * press;
      P.gR = 0.85;
      P.aLs = 0.75;
      P.aLr = -0.45;
      P.eL = 0.9 + 0.1 * press;
      P.gL = 0.5;
      break;
    }
    case "holding":
      restLeftArm(P, t);
      P.hy = 0.25 * Math.sin(t * 0.3);
      P.hx = 0.04 * Math.sin(t * 0.7);
      holdCup(P, 0);
      break;
    case "sipping":
      restLeftArm(P, t);
      holdCup(P, sipLift(t));
      break;
    case "talking": {
      const wave = Math.sin(t * 2.6);
      const beat = Math.pow(Math.max(0, Math.sin(t * 5.2)), 2);
      P.aLs = 0.75 + 0.25 * wave;
      P.aLr = -0.1 + 0.3 * Math.sin(t * 1.9 + 1);
      P.eL = 1.2 + 0.35 * beat;
      P.wL = 0.5 * Math.sin(t * 2.6 + 0.6);
      P.gL = 0.1;
      if (holding) holdCup(P, 0);
      else {
        P.aRs = 0.6 + 0.25 * Math.sin(t * 2.1 + 2);
        P.aRr = -0.2 + 0.2 * Math.sin(t * 1.4);
        P.eR = 1.15 + 0.3 * Math.max(0, -wave);
        P.wR = -0.4 * Math.sin(t * 2.1);
        P.gR = 0.15;
      }
      P.hx = 0.06 * beat - 0.04;
      P.hy = 0.12 * Math.sin(t * 0.9);
      P.hz = 0.05 * Math.sin(t * 1.3);
      P.tw = 0.08 * Math.sin(t * 0.8);
      P.cr = 0.03 * wave;
      P.d = 0.01 * beat;
      break;
    }
    case "listening": {
      const nod = Math.pow(Math.max(0, Math.sin(t * 3.1)), 4) * smooth(Math.sin(t * 0.5), 0, 0.6);
      P.hx = 0.14 * nod - 0.02;
      P.hz = 0.07 * Math.sin(t * 0.4 + offset);
      P.cr = 0.03 * Math.sin(t * 0.4 + offset);
      P.px = 0.04 * Math.sin(t * 0.4 + offset);
      if (holding) {
        restLeftArm(P, t);
        holdCup(P, 0);
      } else {
        P.aLs = P.aRs = 0.85;
        P.aLr = P.aRr = -0.95;
        P.eL = P.eR = 1.55;
        P.gL = P.gR = 0.6;
      }
      break;
    }
  }
  return P;
}

export function seatedPose(height: number, weight: number): Pose {
  const P = zeroPose();
  P.y = height * weight;
  if (height < 0) {
    P.fLu = P.fRu = -height * weight;
    P.fLf = P.fRf = -height * 0.9 * weight;
    P.fLs = -0.06 * weight;
    P.fRs = 0.06 * weight;
    P.cp = -0.06 * weight;
    return P;
  }
  P.fLf = P.fRf = 0.14 * weight;
  P.fLu = P.fRu = 0.07 * weight;
  P.fLs = -0.02 * weight;
  P.fRs = 0.02 * weight;
  return P;
}
