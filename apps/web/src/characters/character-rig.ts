import type { BipedRigProportions, BoneName } from "@nightpaws/shared";
import * as THREE from "three";

export type CharacterBones = Record<BoneName, THREE.Object3D>;

export interface CharacterRig {
  bones: CharacterBones;
  proportions: BipedRigProportions;
  headTopHeight: number;
}

const boneParents: Record<Exclude<BoneName, "root">, BoneName> = {
  hips: "root",
  torso: "hips",
  head: "torso",
  armLeft: "torso",
  armRight: "torso",
  legLeft: "hips",
  legRight: "hips",
  tail: "hips",
};

function restPosition(bone: BoneName, rig: BipedRigProportions): THREE.Vector3 {
  switch (bone) {
    case "root":
    case "torso":
      return new THREE.Vector3(0, 0, 0);
    case "hips":
      return new THREE.Vector3(0, rig.hipHeight, 0);
    case "head":
      return new THREE.Vector3(0, rig.torsoHeight + rig.neckHeight, 0);
    case "armLeft":
      return new THREE.Vector3(rig.shoulderWidth / 2, rig.torsoHeight * 0.85, 0);
    case "armRight":
      return new THREE.Vector3(-rig.shoulderWidth / 2, rig.torsoHeight * 0.85, 0);
    case "legLeft":
      return new THREE.Vector3(rig.hipWidth / 2, 0, 0);
    case "legRight":
      return new THREE.Vector3(-rig.hipWidth / 2, 0, 0);
    case "tail":
      return new THREE.Vector3(0, rig.tailHeight, 0);
  }
}

export const allBoneNames: BoneName[] = ["root", "hips", "torso", "head", "armLeft", "armRight", "legLeft", "legRight", "tail"];

export function createBipedRig(proportions: BipedRigProportions): CharacterRig {
  const bones = {} as CharacterBones;
  for (const name of allBoneNames) {
    const bone = new THREE.Object3D();
    bone.name = name;
    bone.position.copy(restPosition(name, proportions));
    bones[name] = bone;
  }
  for (const [child, parent] of Object.entries(boneParents) as [BoneName, BoneName][]) {
    bones[parent].add(bones[child]);
  }
  return {
    bones,
    proportions,
    headTopHeight: proportions.hipHeight + proportions.torsoHeight + proportions.neckHeight + 0.75,
  };
}

export function mirroredBone(bone: BoneName): BoneName {
  if (bone === "armLeft") return "armRight";
  if (bone === "legLeft") return "legRight";
  if (bone === "armRight") return "armLeft";
  if (bone === "legRight") return "legLeft";
  return bone;
}
