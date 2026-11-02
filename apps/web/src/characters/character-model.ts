import type { CharacterTypeDescriptor, OutfitDescriptor } from "@nightpaws/shared";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { environmentMap, rimify } from "../engine/shading.ts";
import { buildHeroPanda } from "./hero-panda.ts";
import { loadedModel } from "./model-library.ts";

export type RestPose = [THREE.Object3D, THREE.Vector3, THREE.Quaternion, THREE.Vector3][];

export type ShadingQuality = "hero" | "crowd";

export interface CharacterModel {
  root: THREE.Group;
  bones: Record<string, THREE.Object3D>;
  rest: RestPose;
  mixer: THREE.AnimationMixer | null;
  idle: THREE.AnimationAction | null;
  walk: THREE.AnimationAction | null;
  size: number;
  sideL: number;
  eyelids: THREE.Object3D[];
  procedural: boolean;
}

const materialCache = new Map<string, THREE.Material>();

function stylizedMaterial(source: THREE.Material, tint: THREE.Color, quality: ShadingQuality): THREE.Material {
  const key = `${source.uuid}|${tint.getHexString()}|${quality}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const standard = source as THREE.MeshStandardMaterial;
  const color = (standard.color ? standard.color.clone() : new THREE.Color(1, 1, 1)).multiply(tint);
  const map = standard.map ?? null;
  const material =
    quality === "hero"
      ? rimify(
          new THREE.MeshPhysicalMaterial({
            map,
            color,
            roughness: 0.7,
            metalness: 0,
            sheen: 0.5,
            sheenRoughness: 0.5,
            sheenColor: new THREE.Color(0.25, 0.23, 0.3),
            envMap: environmentMap(),
            envMapIntensity: 0.3,
          }),
          0.6,
        )
      : rimify(new THREE.MeshStandardMaterial({ map, color, roughness: 0.75, metalness: 0, envMap: environmentMap(), envMapIntensity: 0.3 }), 0.6);
  materialCache.set(key, material);
  return material;
}

const cuffGeometry = new THREE.TorusGeometry(0.055, 0.012, 8, 24);
const cuffMaterials = new Map<string, THREE.MeshBasicMaterial>();

function cuffMaterial(color: string): THREE.MeshBasicMaterial {
  let material = cuffMaterials.get(color);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color });
    material.color.multiplyScalar(2.6);
    cuffMaterials.set(color, material);
  }
  return material;
}

export function collectBones(object: THREE.Object3D, include: (node: THREE.Object3D) => boolean): Record<string, THREE.Object3D> {
  const bones: Record<string, THREE.Object3D> = {};
  object.traverse((node) => {
    if (!include(node) || !node.name) return;
    bones[node.name] = node;
    const match = node.name.match(/^(.*?)([LR])(_end)?$/);
    if (match && match[1]) bones[`${match[1]}.${match[2]}${match[3] ?? ""}`] = node;
  });
  return bones;
}

export function captureRest(bones: Record<string, THREE.Object3D>): RestPose {
  return [...new Set(Object.values(bones))].map((bone) => [bone, bone.position.clone(), bone.quaternion.clone(), bone.scale.clone()]);
}

export function leftSideSign(root: THREE.Object3D, bones: Record<string, THREE.Object3D>): number {
  const hips = bones.Hips;
  const upperArm = bones["UpperArm.L"];
  if (!hips || !upperArm) return 1;
  root.updateMatrixWorld(true);
  const offset = upperArm.getWorldPosition(new THREE.Vector3()).sub(hips.getWorldPosition(new THREE.Vector3()));
  return Math.sign(offset.x) || 1;
}

function visibleSkinnedBounds(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  object.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh) || !node.visible) return;
    node.computeBoundingBox();
    box.union(node.boundingBox!.clone().applyMatrix4(node.matrixWorld));
  });
  return box;
}

function buildModelCharacter(
  descriptor: CharacterTypeDescriptor,
  outfit: OutfitDescriptor,
  quality: ShadingQuality,
  asset: string,
  hiddenMeshes: string[],
): CharacterModel {
  const gltf = loadedModel(asset);
  const object = SkeletonUtils.clone(gltf.scene);
  const hidden = hiddenMeshes.map((name) => name.replace(/\./g, ""));
  const tint = new THREE.Color("#ffffff").lerp(new THREE.Color(outfit.colors.outfit), 0.18);
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (hidden.includes(node.name.replace(/\./g, ""))) {
      node.visible = false;
      return;
    }
    node.material = Array.isArray(node.material)
      ? node.material.map((material) => stylizedMaterial(material, tint, quality))
      : stylizedMaterial(node.material, tint, quality);
    node.castShadow = false;
    node.frustumCulled = false;
  });

  const root = new THREE.Group();
  root.name = `character:${descriptor.id}`;
  root.add(object);
  const initial = visibleSkinnedBounds(object);
  object.scale.multiplyScalar(descriptor.height / (initial.max.y - initial.min.y || 1));
  const scaled = visibleSkinnedBounds(object);
  object.position.y -= scaled.min.y;
  object.position.x -= (scaled.min.x + scaled.max.x) / 2;
  object.position.z -= (scaled.min.z + scaled.max.z) / 2;
  root.updateMatrixWorld(true);

  const bones = collectBones(object, (node) => node instanceof THREE.Bone);
  for (const side of ["L", "R"]) {
    const lowerArm = bones[`LowerArm.${side}`];
    if (!lowerArm) continue;
    const worldScale = lowerArm.getWorldScale(new THREE.Vector3()).x || 1;
    const cuff = new THREE.Mesh(cuffGeometry, cuffMaterial(side === "L" ? outfit.colors.outfit : outfit.colors.outfitTrim));
    cuff.scale.setScalar(1 / worldScale);
    cuff.position.set(0, (0.17 / worldScale) * 0.9, 0);
    cuff.rotation.x = Math.PI / 2;
    lowerArm.add(cuff);
  }

  const rest = captureRest(bones);
  const mixer = new THREE.AnimationMixer(object);
  const clips = new Map<string, THREE.AnimationClip>();
  for (const clip of gltf.animations) clips.set(clip.name.split("|").pop() ?? clip.name, clip);
  const idleClip = clips.get("Idle");
  const walkClip = clips.get("Walk");
  const idle = idleClip ? mixer.clipAction(idleClip) : null;
  if (idle) {
    idle.play();
    idle.time = Math.random() * idle.getClip().duration;
  }
  const walk = walkClip ? mixer.clipAction(walkClip) : null;
  if (walk) {
    walk.play();
    walk.setEffectiveWeight(0);
  }

  return {
    root,
    bones,
    rest,
    mixer,
    idle,
    walk,
    size: descriptor.height / 1.6,
    sideL: leftSideSign(root, bones),
    eyelids: [],
    procedural: false,
  };
}

export function buildCharacterModel(
  descriptor: CharacterTypeDescriptor,
  outfit: OutfitDescriptor,
  quality: ShadingQuality,
): CharacterModel {
  const source = descriptor.model;
  if (source.kind === "hero-panda") return buildHeroPanda(descriptor, outfit);
  return buildModelCharacter(descriptor, outfit, quality, source.asset, source.hiddenMeshes);
}
