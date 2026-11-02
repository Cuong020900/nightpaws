import type { FloorRect } from "@nightpaws/shared";
import * as THREE from "three";
import { neonMaterial, toonMaterial } from "../../engine/materials.ts";
import { createNeonSign } from "./neon-sign.ts";

export interface FurnitureBlock {
  object: THREE.Group;
  obstacles: FloorRect[];
}

const bottleColors = ["#3dff8a", "#ff2e88", "#ffd23f", "#26f0ff", "#ff6a3d", "#9b5cff"];

export function createBarCounter(wallX: number): FurnitureBlock {
  const object = new THREE.Group();
  object.name = "bar-counter";
  const counterX = wallX + 2.6;
  const counterLength = 9;
  const counterCenterZ = -0.5;

  const woodMaterial = new THREE.MeshStandardMaterial({ color: "#3a1f3f", roughness: 0.6 });
  const topMaterial = new THREE.MeshStandardMaterial({ color: "#120c1c", roughness: 0.15, metalness: 0.6 });

  const counterBody = new THREE.Mesh(new THREE.BoxGeometry(1, 1.05, counterLength), woodMaterial);
  counterBody.position.set(counterX, 0.525, counterCenterZ);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, counterLength + 0.2), topMaterial);
  counterTop.position.set(counterX, 1.09, counterCenterZ);
  const counterGlow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, counterLength), neonMaterial("#ff2e88", 3));
  counterGlow.position.set(counterX + 0.53, 0.9, counterCenterZ);
  const footGlow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, counterLength), neonMaterial("#26f0ff", 2.4));
  footGlow.position.set(counterX + 0.53, 0.12, counterCenterZ);
  object.add(counterBody, counterTop, counterGlow, footGlow);

  const shelfMaterial = new THREE.MeshStandardMaterial({ color: "#221833", roughness: 0.5 });
  for (const shelfHeight of [1.6, 2.3, 3]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, counterLength - 1), shelfMaterial);
    shelf.position.set(wallX + 0.25, shelfHeight, counterCenterZ);
    object.add(shelf);
    const bottleCount = 14;
    for (let index = 0; index < bottleCount; index += 1) {
      const bottleHeight = 0.32 + ((index * 7) % 3) * 0.06;
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, bottleHeight, 10),
        neonMaterial(bottleColors[(index + Math.round(shelfHeight * 3)) % bottleColors.length]!, 1.3),
      );
      bottle.position.set(
        wallX + 0.25,
        shelfHeight + 0.03 + bottleHeight / 2,
        counterCenterZ - (counterLength - 1.6) / 2 + index * ((counterLength - 1.6) / (bottleCount - 1)),
      );
      object.add(bottle);
    }
  }

  const sign = createNeonSign({ text: "BAR", color: "#3dff8a", glow: "#00ff9c", width: 3.2 });
  sign.position.set(wallX + 0.06, 4.2, counterCenterZ);
  sign.rotation.y = Math.PI / 2;
  object.add(sign);

  const stoolSeat = toonMaterial("#ff2e88");
  const stoolMetal = new THREE.MeshStandardMaterial({ color: "#8a86a0", metalness: 0.9, roughness: 0.3 });
  for (let z = counterCenterZ - 3.6; z <= counterCenterZ + 3.6; z += 1.8) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.12, 16), stoolSeat);
    seat.position.set(counterX + 1.15, 0.78, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8), stoolMetal);
    pole.position.set(counterX + 1.15, 0.38, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 16), stoolMetal);
    base.position.set(counterX + 1.15, 0.02, z);
    object.add(seat, pole, base);
  }

  const barLight = new THREE.PointLight("#ff4fa3", 12, 9, 1.4);
  barLight.position.set(counterX + 1, 3, counterCenterZ);
  object.add(barLight);

  return {
    object,
    obstacles: [
      {
        minX: counterX - 0.65,
        maxX: counterX + 0.65,
        minZ: counterCenterZ - counterLength / 2 - 0.1,
        maxZ: counterCenterZ + counterLength / 2 + 0.1,
      },
      { minX: wallX, maxX: counterX, minZ: counterCenterZ - counterLength / 2, maxZ: counterCenterZ + counterLength / 2 },
    ],
  };
}

function createCouch(color: string): THREE.Group {
  const couch = new THREE.Group();
  const fabric = toonMaterial(color);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 2.8), fabric);
  seat.position.y = 0.3;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 2.8), fabric);
  back.position.set(0.45, 0.65, 0);
  const armLeft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.3), fabric);
  armLeft.position.set(0, 0.45, 1.4);
  const armRight = armLeft.clone();
  armRight.position.z = -1.4;
  couch.add(seat, back, armLeft, armRight);
  return couch;
}

export function createLounge(wallX: number): FurnitureBlock {
  const object = new THREE.Group();
  object.name = "lounge";
  const couchX = wallX - 0.8;
  const couchSpecs = [
    { z: -3.6, color: "#5a2bd6" },
    { z: 1.6, color: "#1fa6c9" },
  ];
  const obstacles: FloorRect[] = [];

  for (const spec of couchSpecs) {
    const couch = createCouch(spec.color);
    couch.position.set(couchX, 0, spec.z);
    object.add(couch);
    obstacles.push({ minX: couchX - 0.55, maxX: wallX, minZ: spec.z - 1.6, maxZ: spec.z + 1.6 });

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24),
      new THREE.MeshStandardMaterial({ color: "#120c1c", metalness: 0.7, roughness: 0.2 }),
    );
    table.position.set(couchX - 1.5, 0.5, spec.z);
    const tableGlow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 32), neonMaterial("#ffd23f", 2.2));
    tableGlow.rotation.x = Math.PI / 2;
    tableGlow.position.copy(table.position);
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.5, 10), toonMaterial("#2a2438"));
    tableLeg.position.set(couchX - 1.5, 0.25, spec.z);
    object.add(table, tableGlow, tableLeg);
    obstacles.push({ minX: couchX - 2, maxX: couchX - 1, minZ: spec.z - 0.5, maxZ: spec.z + 0.5 });
  }

  const sign = createNeonSign({ text: "THE NEON PAW", color: "#ff5fd2", glow: "#ff2e88", width: 6 });
  sign.position.set(wallX - 0.06, 3.6, -1);
  sign.rotation.y = -Math.PI / 2;
  object.add(sign);

  const loungeLight = new THREE.PointLight("#26c6ff", 10, 9, 1.4);
  loungeLight.position.set(wallX - 2.5, 3, -1);
  object.add(loungeLight);

  return { object, obstacles };
}

export function createEntranceDecor(frontWallZ: number): THREE.Group {
  const decor = new THREE.Group();
  const pawSign = createNeonSign({ text: "🐾 PARTY ANIMALS ONLY", color: "#ffd23f", glow: "#ff8a1f", width: 7, font: "Bungee, Impact, sans-serif" });
  pawSign.position.set(0, 4.3, frontWallZ - 0.06);
  pawSign.rotation.y = Math.PI;
  decor.add(pawSign);
  return decor;
}
