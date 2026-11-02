import {
  resolveCharacterPalette,
  type CharacterPartDescriptor,
  type CharacterTypeDescriptor,
  type OutfitDescriptor,
  type PartShape,
} from "@nightpaws/shared";
import * as THREE from "three";
import { eyeHighlightMaterial, outlineMaterial, toonMaterial } from "../engine/materials.ts";
import { createBipedRig, mirroredBone, type CharacterRig } from "./character-rig.ts";

const outlineThickness = 0.022;

function normalizedToUnitBox(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
  geometry.computeVertexNormals();
  return geometry;
}

function createUnitGeometry(shape: PartShape): THREE.BufferGeometry {
  switch (shape) {
    case "sphere":
      return normalizedToUnitBox(new THREE.SphereGeometry(0.5, 20, 14));
    case "box":
      return normalizedToUnitBox(new THREE.BoxGeometry(1, 1, 1));
    case "capsule":
      return normalizedToUnitBox(new THREE.CapsuleGeometry(0.5, 0.8, 6, 14));
    case "cylinder":
      return normalizedToUnitBox(new THREE.CylinderGeometry(0.5, 0.5, 1, 20));
    case "cone":
      return normalizedToUnitBox(new THREE.ConeGeometry(0.5, 1, 16));
    case "torus":
      return normalizedToUnitBox(new THREE.TorusGeometry(0.5, 0.16, 10, 24).rotateX(Math.PI / 2));
  }
}

const geometryCache = new Map<PartShape, THREE.BufferGeometry>();
const highlightGeometry = new THREE.SphereGeometry(0.5, 10, 8);

function unitGeometry(shape: PartShape): THREE.BufferGeometry {
  let geometry = geometryCache.get(shape);
  if (!geometry) {
    geometry = createUnitGeometry(shape);
    geometryCache.set(shape, geometry);
  }
  return geometry;
}

export interface BuiltCharacter {
  root: THREE.Group;
  rig: CharacterRig;
  descriptor: CharacterTypeDescriptor;
  outfit: OutfitDescriptor;
}

function createPartMesh(part: CharacterPartDescriptor, color: string, mirrorX: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(unitGeometry(part.shape), toonMaterial(color));
  const [x, y, z] = part.offset;
  mesh.position.set(mirrorX ? -x : x, y, z);
  mesh.scale.set(...part.size);
  if (part.rotation) {
    const [rx, ry, rz] = part.rotation;
    mesh.rotation.set(rx, mirrorX ? -ry : ry, mirrorX ? -rz : rz);
  }
  mesh.castShadow = false;
  mesh.name = part.id;

  if (part.outlined) {
    const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
    outline.scale.set(
      1 + (2 * outlineThickness) / part.size[0],
      1 + (2 * outlineThickness) / part.size[1],
      1 + (2 * outlineThickness) / part.size[2],
    );
    mesh.add(outline);
  }

  if (part.glossy) {
    const highlight = new THREE.Mesh(highlightGeometry, eyeHighlightMaterial);
    highlight.scale.setScalar(0.38);
    highlight.position.set(mirrorX ? -0.18 : 0.18, 0.2, 0.32);
    mesh.add(highlight);
  }
  return mesh;
}

export function buildCharacter(descriptor: CharacterTypeDescriptor, outfit: OutfitDescriptor): BuiltCharacter {
  const palette = resolveCharacterPalette(descriptor, outfit);
  const rig = createBipedRig(descriptor.rig);

  for (const part of descriptor.parts) {
    const color = palette[part.colorSlot];
    rig.bones[part.bone].add(createPartMesh(part, color, false));
    if (part.mirrored) {
      rig.bones[mirroredBone(part.bone)].add(createPartMesh(part, color, true));
    }
  }

  const root = new THREE.Group();
  root.name = `character:${descriptor.id}`;
  root.add(rig.bones.root);
  root.scale.setScalar(descriptor.scale);
  return { root, rig, descriptor, outfit };
}
