import * as THREE from "three";
import type { ClubMood, Triple } from "../common/club-kit.ts";

export const ceilingHeight = 4.6;

export const officePartyMood: ClubMood = {
  name: "After Hours",
  bpm: 120,
  colors: ["#ffb84a", "#3ad4ff", "#ff4fa3", "#8a5cff"],
  ambient: "#55618c",
  ground: "#1c1a26",
  fog: "#0d1222",
  fogDensity: 0.011,
  bloom: 0.62,
  wall: "#3b4459",
  grade: [1.0, 0.99, 1.03],
};

export type ShapeKind = "box" | "cylinder" | "ball" | "cone";

export interface ShapePlacement {
  at: Triple;
  size: Triple;
  turn?: number;
  tilt?: number;
  color?: THREE.ColorRepresentation;
}

const unitGeometry: Record<ShapeKind, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 1, 18),
  ball: () => new THREE.SphereGeometry(1, 16, 12),
  cone: () => new THREE.ConeGeometry(1, 1, 18),
};

interface Batch {
  kind: ShapeKind;
  material: THREE.Material;
  placements: ShapePlacement[];
}

export class ShapeBatch {
  private readonly batches = new Map<string, Batch>();

  add(kind: ShapeKind, material: THREE.Material, placement: ShapePlacement): void {
    const key = `${kind}:${material.uuid}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { kind, material, placements: [] };
      this.batches.set(key, batch);
    }
    batch.placements.push(placement);
  }

  box(material: THREE.Material, at: Triple, size: Triple, turn = 0, color?: THREE.ColorRepresentation): void {
    this.add("box", material, { at, size, turn, ...(color === undefined ? {} : { color }) });
  }

  cylinder(material: THREE.Material, at: Triple, radius: number, height: number, color?: THREE.ColorRepresentation): void {
    this.add("cylinder", material, { at, size: [radius, height, radius], ...(color === undefined ? {} : { color }) });
  }

  build(parent: THREE.Object3D): THREE.InstancedMesh[] {
    return [...this.batches.values()].map((batch) => instancedShapes(parent, batch.kind, batch.material, batch.placements));
  }
}

const matrix = new THREE.Matrix4();
const rotation = new THREE.Quaternion();
const euler = new THREE.Euler();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const tint = new THREE.Color();

export function composePlacement(placement: ShapePlacement, target: THREE.Matrix4 = matrix): THREE.Matrix4 {
  rotation.setFromEuler(euler.set(placement.tilt ?? 0, placement.turn ?? 0, 0, "YXZ"));
  return target.compose(position.set(...placement.at), rotation, scale.set(...placement.size));
}

export function instancedShapes(parent: THREE.Object3D, kind: ShapeKind, material: THREE.Material, placements: ShapePlacement[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(unitGeometry[kind](), material, placements.length);
  const colored = placements.some((placement) => placement.color !== undefined);
  placements.forEach((placement, index) => {
    mesh.setMatrixAt(index, composePlacement(placement));
    if (colored) mesh.setColorAt(index, tint.set(placement.color ?? 0xffffff));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}
