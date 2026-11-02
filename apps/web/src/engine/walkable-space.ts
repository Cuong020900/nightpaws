import type { FloorRect } from "@nightpaws/shared";
import * as THREE from "three";

export class WalkableSpace {
  constructor(
    readonly bounds: FloorRect,
    readonly obstacles: FloorRect[],
  ) {}

  constrain(position: THREE.Vector3, radius: number): void {
    position.x = THREE.MathUtils.clamp(position.x, this.bounds.minX + radius, this.bounds.maxX - radius);
    position.z = THREE.MathUtils.clamp(position.z, this.bounds.minZ + radius, this.bounds.maxZ - radius);

    for (const obstacle of this.obstacles) {
      const nearestX = THREE.MathUtils.clamp(position.x, obstacle.minX, obstacle.maxX);
      const nearestZ = THREE.MathUtils.clamp(position.z, obstacle.minZ, obstacle.maxZ);
      const offsetX = position.x - nearestX;
      const offsetZ = position.z - nearestZ;
      const distanceSquared = offsetX * offsetX + offsetZ * offsetZ;
      if (distanceSquared >= radius * radius) continue;

      if (distanceSquared > 1e-6) {
        const distance = Math.sqrt(distanceSquared);
        const push = (radius - distance) / distance;
        position.x += offsetX * push;
        position.z += offsetZ * push;
        continue;
      }

      const exits = [
        { axis: "x", value: obstacle.minX - radius, cost: position.x - obstacle.minX },
        { axis: "x", value: obstacle.maxX + radius, cost: obstacle.maxX - position.x },
        { axis: "z", value: obstacle.minZ - radius, cost: position.z - obstacle.minZ },
        { axis: "z", value: obstacle.maxZ + radius, cost: obstacle.maxZ - position.z },
      ] as const;
      const cheapest = exits.reduce((best, exit) => (exit.cost < best.cost ? exit : best));
      position[cheapest.axis] = cheapest.value;
    }
  }

  isFree(x: number, z: number, radius: number): boolean {
    if (x < this.bounds.minX + radius || x > this.bounds.maxX - radius) return false;
    if (z < this.bounds.minZ + radius || z > this.bounds.maxZ - radius) return false;
    return this.obstacles.every(
      (obstacle) =>
        x < obstacle.minX - radius || x > obstacle.maxX + radius || z < obstacle.minZ - radius || z > obstacle.maxZ + radius,
    );
  }

  randomFreePoint(area: FloorRect, radius: number, random: () => number = Math.random): THREE.Vector3 {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = THREE.MathUtils.lerp(area.minX, area.maxX, random());
      const z = THREE.MathUtils.lerp(area.minZ, area.maxZ, random());
      if (this.isFree(x, z, radius)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3((area.minX + area.maxX) / 2, 0, (area.minZ + area.maxZ) / 2);
  }
}
