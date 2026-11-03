import type { FloorRect } from "@nightpaws/shared";
import * as THREE from "three";
import { clothMaterial, metalMaterial, venueMaterial } from "../../engine/shading.ts";
import { place, rnd, textSign, TAU, type NeonPalette, type Triple } from "../common/club-kit.ts";
import { ceilingHeight as H, instancedShapes, ShapeBatch, type ShapePlacement } from "./office-kit.ts";
import {
  bannerTexture,
  carpetTexture,
  clockTexture,
  posterTexture,
  receptionTexture,
  skylineTexture,
  vendingTexture,
  whiteboardTexture,
  woodFloorTexture,
} from "./office-textures.ts";

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): FloorRect => ({ minX, maxX, minZ, maxZ });

export const podCenters: [number, number][] = [-1, 1].flatMap((side) => [-8, -3, 1.2].map((z): [number, number] => [side * 10.5, z]));

export const plantSpots: [number, number, number][] = [
  [-14.3, -11.4, 1.2],
  [14.2, -11.4, 1.2],
  [-7.3, -11.4, 1],
  [7.3, -11.4, 1],
  [-14.2, 11.3, 1.15],
  [14.1, 11.2, 1.2],
  [-3.6, 11.45, 0.9],
  [3.6, 11.45, 0.9],
  [-13.9, -5.5, 0.85],
  [13.9, -5.5, 0.85],
  [13.9, 3.5, 0.9],
  [-6.6, -0.2, 0.8],
  [6.6, -2.0, 0.8],
];

export const officeObstacles: FloorRect[] = [
  ...podCenters.map(([x, z]) => rect(x - 1.62, x + 1.62, z - 1.5, z + 1.5)),
  rect(-1.7, 1.7, -12, -9.4),
  rect(-5.6, -4.8, -12, -11.05),
  rect(4.8, 5.6, -12, -11.05),
  rect(-13.7, -8.1, -12, -11.25),
  rect(8.1, 13.7, -12, -11.25),
  rect(7.9, 13.3, 5.25, 7.75),
  rect(-15, -14.2, 1.85, 10.05),
  rect(-12.65, -9.75, 5.6, 7.0),
  rect(-12.15, -11.05, 11.1, 12),
  rect(-7.6, -4.8, 10.5, 11.6),
  rect(-6.85, -5.55, 9.5, 10.2),
  rect(4.7, 8.1, 10.1, 11.05),
  rect(6.7, 7.3, -1.1, -0.5),
  rect(-7.3, -6.7, -1.1, -0.5),
  ...plantSpots.map(([x, z]) => rect(x - 0.32, x + 0.32, z - 0.32, z + 0.32)),
];

export interface OfficeParts {
  screen: THREE.Mesh<THREE.PlaneGeometry>;
  monitors: THREE.InstancedMesh;
  panels: THREE.InstancedMesh;
  partyPanels: boolean[];
  panelCenters: THREE.Vector2[];
  bulbs: THREE.InstancedMesh;
  bulbStrand: number[];
  balloons: THREE.InstancedMesh;
  balloonRest: ShapePlacement[];
  discoBall: THREE.Mesh;
  jogWheels: THREE.Mesh[];
  mixerLeds: THREE.Mesh[];
  woofers: THREE.Mesh[];
}

interface Materials {
  wall: THREE.MeshStandardMaterial;
  accentWall: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  desk: THREE.MeshStandardMaterial;
  deskFrame: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  tinted: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
  walnut: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
}

function materials(wallColor: string): Materials {
  return {
    wall: venueMaterial({ color: wallColor, roughness: 0.92 }),
    accentWall: venueMaterial({ color: "#2a3350", roughness: 0.9 }),
    trim: venueMaterial({ color: "#d9d6cf", roughness: 0.6 }),
    desk: venueMaterial({ color: "#c49766", roughness: 0.55 }),
    deskFrame: venueMaterial({ color: "#e9e7e2", roughness: 0.5 }),
    dark: venueMaterial({ color: "#20232b", roughness: 0.45 }),
    steel: metalMaterial("#9aa3b2", { roughness: 0.38, envMapIntensity: 0.7 }),
    white: venueMaterial({ color: "#ffffff", roughness: 0.55 }),
    tinted: venueMaterial({ color: "#ffffff", roughness: 0.7 }),
    fabric: clothMaterial("#ffffff", { roughness: 0.9, envMapIntensity: 0.15 }),
    walnut: venueMaterial({ color: "#5c3b26", roughness: 0.45 }),
    ceramic: venueMaterial({ color: "#e6e0d4", roughness: 0.35 }),
    leaf: venueMaterial({ color: "#ffffff", roughness: 0.75, flatShading: true }),
  };
}

const along = (x: number, z: number, turn: number, dx: number, dz: number): [number, number] => [
  x + dx * Math.cos(turn) + dz * Math.sin(turn),
  z - dx * Math.sin(turn) + dz * Math.cos(turn),
];

function addChair(batch: ShapeBatch, m: Materials, x: number, z: number, turn: number, seatColor: string): void {
  batch.box(m.fabric, [x, 0.5, z], [0.5, 0.08, 0.48], turn, seatColor);
  const [bx, bz] = along(x, z, turn, 0, -0.23);
  batch.box(m.fabric, [bx, 0.86, bz], [0.48, 0.56, 0.07], turn, seatColor);
  batch.cylinder(m.steel, [x, 0.27, z], 0.03, 0.42);
  batch.add("cylinder", m.dark, { at: [x, 0.05, z], size: [0.3, 0.05, 0.3] });
}

function buildShell(parent: THREE.Object3D, batch: ShapeBatch, m: Materials): void {
  place(parent, new THREE.PlaneGeometry(30, 24), venueMaterial({ map: carpetTexture(), roughness: 0.95 }), [0, 0, 0], [-Math.PI / 2, 0, 0]);
  place(parent, new THREE.PlaneGeometry(13, 11.5), venueMaterial({ map: woodFloorTexture(), roughness: 0.38, metalness: 0.05 }), [0, 0.004, -3.25], [-Math.PI / 2, 0, 0]);
  for (const [at, size] of [
    [[0, 0.012, 2.52], [13.1, 0.024, 0.08]],
    [[0, 0.012, -9.02], [13.1, 0.024, 0.08]],
    [[-6.52, 0.012, -3.25], [0.08, 0.024, 11.6]],
    [[6.52, 0.012, -3.25], [0.08, 0.024, 11.6]],
  ] as [Triple, Triple][])
    batch.box(m.trim, at, size);
  place(parent, new THREE.PlaneGeometry(30, 24), venueMaterial({ color: "#2a2e39", roughness: 0.95 }), [0, H, 0], [Math.PI / 2, 0, 0]);

  place(parent, new THREE.PlaneGeometry(30, H), m.wall, [0, H / 2, -12]);
  place(parent, new THREE.PlaneGeometry(11.4, H), m.accentWall, [0, H / 2, -11.99]);
  place(parent, new THREE.PlaneGeometry(30, H), m.wall, [0, H / 2, 12], [0, Math.PI, 0]);
  place(parent, new THREE.PlaneGeometry(24, H), m.wall, [-15, H / 2, 0], [0, Math.PI / 2, 0]);
  for (const [at, size] of [
    [[0, 0.06, -11.97], [30, 0.12, 0.04]],
    [[0, 0.06, 11.97], [30, 0.12, 0.04]],
    [[-14.97, 0.06, 0], [0.04, 0.12, 24]],
  ] as [Triple, Triple][])
    batch.box(m.dark, at, size);

  place(parent, new THREE.PlaneGeometry(23.8, 3.72), new THREE.MeshBasicMaterial({ map: skylineTexture(), color: new THREE.Color(1.05, 1.05, 1.1) }), [15.02, 2.3, 0], [0, -Math.PI / 2, 0]);
  place(
    parent,
    new THREE.PlaneGeometry(23.8, 3.72),
    venueMaterial({ color: "#8fb4ff", metalness: 1, roughness: 0.06, transparent: true, opacity: 0.1, depthWrite: false }),
    [14.96, 2.3, 0],
    [0, -Math.PI / 2, 0],
  );
  batch.box(m.trim, [14.86, 0.22, 0], [0.32, 0.44, 24]);
  batch.box(m.wall, [14.9, 4.38, 0], [0.24, 0.44, 24]);
  for (let z = -11.9; z <= 12; z += 2.38) batch.box(m.steel, [14.9, 2.3, z], [0.12, 3.74, 0.1]);
  batch.box(m.steel, [14.9, 0.46, 0], [0.14, 0.05, 24]);
  batch.box(m.steel, [14.9, 4.15, 0], [0.14, 0.05, 24]);

  const duct = metalMaterial("#4a505c", { roughness: 0.55, envMapIntensity: 0.4 });
  for (const x of [-7, 7]) {
    batch.box(m.wall, [x, H / 2, -0.8], [0.6, H, 0.6]);
    batch.add("cylinder", duct, { at: [x, H - 0.42, 0], size: [0.28, 24, 0.28], tilt: Math.PI / 2 });
  }
}

function buildStageWall(parent: THREE.Object3D, batch: ShapeBatch, m: Materials, neon: NeonPalette): Pick<OfficeParts, "screen" | "jogWheels" | "mixerLeds" | "woofers"> {
  batch.box(m.dark, [0, 2.62, -11.95], [9.3, 3.86, 0.06]);
  const screen = place(parent, new THREE.PlaneGeometry(9, 3.6), new THREE.MeshBasicMaterial({ color: 0x000000 }), [0, 2.62, -11.9]) as THREE.Mesh<THREE.PlaneGeometry>;
  place(parent, new THREE.BoxGeometry(9.4, 0.05, 0.05), neon.material(1, 2.2, { pulse: 1 }), [0, 0.8, -11.88]);

  batch.box(m.dark, [0, 1.02, -9.85], [3.1, 0.06, 0.86]);
  batch.box(m.dark, [0, 0.52, -9.44], [3.1, 0.96, 0.04]);
  for (const x of [-1.5, 1.5]) batch.box(m.dark, [x, 0.5, -9.85], [0.06, 1.0, 0.8]);
  place(parent, new THREE.BoxGeometry(3.0, 0.04, 0.04), neon.material(2, 2.4, { pulse: 1 }), [0, 0.08, -9.41]);
  place(parent, new THREE.BoxGeometry(3.0, 0.04, 0.04), neon.material(0, 2.4, { pulse: 1 }), [0, 0.98, -9.41]);
  batch.box(m.steel, [-0.62, 1.06, -9.95], [0.38, 0.02, 0.26]);
  batch.add("box", m.steel, { at: [-0.62, 1.2, -9.84], size: [0.38, 0.26, 0.014], tilt: -0.3 });
  place(parent, new THREE.CircleGeometry(0.05, 20), neon.material(1, 2.6), [-0.62, 1.2, -9.825], [-0.3, 0, 0]);
  batch.box(m.dark, [0.3, 1.075, -9.9], [0.92, 0.05, 0.38]);
  const jogMaterial = metalMaterial("#3a3f4c", { roughness: 0.25 });
  const jogWheels = [0.05, 0.55].map((x) => place(parent, new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24), jogMaterial, [x, 1.11, -9.9]));
  const mixerLeds = Array.from({ length: 6 }, (_, i) =>
    place(parent, new THREE.BoxGeometry(0.03, 0.012, 0.03), neon.material(i % 3, 3), [0.22 + (i % 3) * 0.06, 1.106, -9.98 + Math.floor(i / 3) * 0.07]),
  );

  const woofers: THREE.Mesh[] = [];
  const cone = venueMaterial({ color: "#14161c", roughness: 0.6 });
  for (const x of [-5.2, 5.2]) {
    batch.box(m.tinted, [x, 0.78, -11.45], [0.66, 1.56, 0.52], 0, "#3a4052");
    batch.box(m.steel, [x, 1.57, -11.45], [0.68, 0.02, 0.54]);
    for (const [y, radius] of [
      [0.48, 0.22],
      [1.08, 0.15],
    ] as const) {
      const woofer = place(parent, new THREE.CylinderGeometry(radius, radius * 0.8, 0.04, 24), cone, [x, y, -11.18], [Math.PI / 2, 0, 0]);
      woofers.push(woofer);
    }
    place(parent, new THREE.TorusGeometry(0.24, 0.012, 6, 32), neon.material(3, 2.2, { pulse: 1 }), [x, 0.48, -11.17]);
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      const x = side * (8.55 + i * 0.9);
      batch.box(m.steel, [x, 0.65, -11.62], [0.88, 1.3, 0.6]);
      for (const y of [0.32, 0.74, 1.12]) batch.box(m.dark, [x, y, -11.31], [0.22, 0.03, 0.03]);
    }
    for (let i = 0; i < 5; i += 1) {
      batch.box(m.tinted, [side * (9.2 + i * 0.12), 1.44, -11.65], [0.08, 0.28, 0.3], 0, ["#c2185b", "#1f4fbf", "#2e7d32", "#ef6c00", "#6a1b9a"][i]);
    }
  }
  return { screen, jogWheels, mixerLeds, woofers };
}

function buildDeskPods(parent: THREE.Object3D, batch: ShapeBatch, m: Materials): THREE.InstancedMesh {
  const screens: ShapePlacement[] = [];
  const seatColors = ["#3b4f7a", "#2f6b62", "#6b3b5a", "#4a4a58"];
  const mugColors = ["#e8e2d6", "#d6283c", "#1f4fbf", "#ffb84a"];
  podCenters.forEach(([cx, cz], pod) => {
    batch.box(m.fabric, [cx, 0.95, cz], [3.14, 0.38, 0.035], 0, ["#5b6b8c", "#6b8c7a", "#8c6b7a"][pod % 3]);
    for (const sx of [-1, 1]) {
      batch.box(m.deskFrame, [cx + sx * 1.53, 0.37, cz], [0.04, 0.74, 1.5]);
      for (const sz of [-1, 1]) {
        const x = cx + sx * 0.78;
        const z = cz + sz * 0.4;
        batch.box(m.desk, [x, 0.74, z], [1.52, 0.035, 0.78]);
        batch.cylinder(m.dark, [x, 0.86, cz + sz * 0.13], 0.025, 0.2);
        batch.box(m.dark, [x, 1.08, cz + sz * 0.11], [0.6, 0.36, 0.025]);
        screens.push({ at: [x, 1.08, cz + sz * 0.125], size: [0.55, 0.31, 1], turn: sz > 0 ? 0 : Math.PI });
        batch.box(m.dark, [x, 0.765, cz + sz * 0.52], [0.42, 0.015, 0.14]);
        batch.cylinder(m.ceramic, [x + 0.48, 0.805, cz + sz * 0.5], 0.04, 0.09, mugColors[(pod + sx + sz + 4) % mugColors.length]);
        const turn = (sz > 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.7;
        addChair(batch, m, x + (rnd() - 0.5) * 0.2, cz + sz * 1.1, turn, seatColors[(pod + (sx > 0 ? 1 : 0)) % seatColors.length]!);
      }
    }
    batch.box(m.deskFrame, [cx, 0.37, cz], [0.04, 0.74, 1.5]);
  });
  return instancedShapes(parent, "box", new THREE.MeshBasicMaterial({ color: 0xffffff }), screens.map((s) => ({ ...s, size: [s.size[0], s.size[1], 0.002], color: "#ffffff" })));
}

function buildMeetingNook(parent: THREE.Object3D, batch: ShapeBatch, m: Materials): void {
  const [cx, cz] = [10.6, 6.5];
  place(parent, new THREE.PlaneGeometry(6.4, 4.2), venueMaterial({ color: "#2c3850", roughness: 1 }), [cx, 0.006, cz], [-Math.PI / 2, 0, 0]);
  batch.box(m.walnut, [cx, 0.75, cz], [4.2, 0.06, 1.6]);
  for (const dx of [-1.4, 1.4]) batch.box(m.dark, [cx + dx, 0.36, cz], [0.3, 0.72, 0.9]);
  for (const dx of [-1.3, 0, 1.3]) {
    addChair(batch, m, cx + dx, cz - 1.08, 0, "#2b3140");
    addChair(batch, m, cx + dx, cz + 1.08, Math.PI, "#2b3140");
  }
  addChair(batch, m, cx - 2.45, cz, Math.PI / 2, "#2b3140");
  addChair(batch, m, cx + 2.45, cz, -Math.PI / 2, "#2b3140");
  batch.box(m.tinted, [cx + 0.9, 0.79, cz - 0.3], [0.32, 0.02, 0.24], 0.4, "#f2efe8");
  batch.box(m.tinted, [cx - 0.6, 0.79, cz + 0.35], [0.3, 0.02, 0.22], -0.3, "#f2efe8");
  place(parent, new THREE.CylinderGeometry(0.006, 0.006, 1.0, 4), m.dark, [cx, H - 0.5, cz]);
  place(parent, new THREE.CylinderGeometry(0.12, 0.42, 0.3, 24, 1, true), metalMaterial("#1d2230", { side: THREE.DoubleSide, roughness: 0.4 }), [cx, H - 1.12, cz]);
  place(parent, new THREE.CircleGeometry(0.4, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 1.1) }), [cx, H - 1.26, cz], [Math.PI / 2, 0, 0]);
}

function buildPantry(parent: THREE.Object3D, batch: ShapeBatch, m: Materials): void {
  batch.box(m.trim, [-14.66, 0.44, 6.0], [0.66, 0.88, 6.0]);
  batch.box(m.dark, [-14.63, 0.9, 6.0], [0.72, 0.04, 6.04]);
  batch.box(m.trim, [-14.78, 2.05, 5.6], [0.4, 0.75, 5.0]);
  for (let z = 3.6; z < 8.2; z += 0.83) batch.box(m.steel, [-14.56, 1.8, z], [0.02, 0.02, 0.18]);
  batch.box(m.steel, [-14.58, 1.0, 9.62], [0.82, 2.0, 0.8]);
  batch.box(m.dark, [-14.16, 1.25, 9.62], [0.02, 0.5, 0.04]);
  batch.box(m.dark, [-14.66, 1.11, 4.0], [0.32, 0.38, 0.32]);
  place(parent, new THREE.BoxGeometry(0.02, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.3) }), [-14.49, 1.24, 4.05]);
  batch.box(m.dark, [-14.66, 1.07, 7.6], [0.4, 0.3, 0.5]);
  place(parent, new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ color: "#1d2a3a" }), [-14.455, 1.07, 7.55], [0, Math.PI / 2, 0]);

  batch.box(m.trim, [-14.56, 0.5, 2.2], [0.36, 1.0, 0.36]);
  place(parent, new THREE.CylinderGeometry(0.15, 0.15, 0.44, 20), venueMaterial({ color: "#7fc8ff", transparent: true, opacity: 0.55, roughness: 0.08 }), [-14.56, 1.22, 2.2]);
  batch.cylinder(m.white, [-14.32, 0.9, 2.42], 0.035, 0.22);

  batch.box(m.tinted, [-11.2, 0.46, 6.3], [2.6, 0.92, 1.1], 0, "#3f4c66");
  batch.box(m.ceramic, [-11.2, 0.94, 6.3], [2.72, 0.04, 1.22]);
  for (const [x, z, stack] of [
    [-12.1, 6.05, 3],
    [-11.55, 6.55, 1],
    [-10.3, 6.1, 2],
  ] as const) {
    for (let level = 0; level < stack; level += 1) batch.box(m.tinted, [x, 0.98 + level * 0.045, z], [0.42, 0.04, 0.42], (rnd() - 0.5) * 0.3, "#c8a070");
  }
  batch.add("cylinder", m.tinted, { at: [-11.55, 1.01, 6.55], size: [0.19, 0.015, 0.19], color: "#e8a33a" });
  for (let i = 0; i < 9; i += 1) batch.cylinder(m.tinted, [-11.0 + (i % 3) * 0.12, 1.015, 6.0 + Math.floor(i / 3) * 0.12], 0.038, 0.11, "#d6283c");
  batch.add("ball", m.tinted, { at: [-10.75, 1.0, 6.6], size: [0.24, 0.12, 0.24], color: "#ff6fa8" });

  place(parent, new THREE.CircleGeometry(0.34, 32), venueMaterial({ map: clockTexture(), roughness: 0.4 }), [-14.97, 3.25, 6.0], [0, Math.PI / 2, 0]);

  batch.box(m.tinted, [-11.6, 0.95, 11.55], [1.0, 1.9, 0.75], 0, "#8c1d2b");
  place(parent, new THREE.PlaneGeometry(0.62, 1.24), new THREE.MeshBasicMaterial({ map: vendingTexture(), color: new THREE.Color(1.5, 1.5, 1.5) }), [-11.75, 1.12, 11.17], [0, Math.PI, 0]);
}

function buildFrontOfHouse(parent: THREE.Object3D, batch: ShapeBatch, m: Materials, neon: NeonPalette): void {
  for (const x of [-2.0, 2.0]) {
    batch.box(m.steel, [x, 1.28, 11.96], [1.5, 2.56, 0.06]);
    batch.box(m.dark, [x, 1.28, 11.92], [0.02, 2.56, 0.02]);
    batch.box(m.trim, [x, 2.62, 11.95], [1.7, 0.12, 0.1]);
    for (const dx of [-0.8, 0.8]) batch.box(m.trim, [x + dx, 1.3, 11.95], [0.1, 2.6, 0.1]);
    place(parent, new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.4, 0.4) }), [x, 2.86, 11.93], [0, Math.PI, 0]);
  }
  batch.box(m.dark, [0, 1.25, 11.95], [0.14, 0.3, 0.04]);
  place(parent, new THREE.CircleGeometry(0.025, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 2, 3) }), [0, 1.3, 11.92], [0, Math.PI, 0]);
  const sign = textSign(neon, "PAWSWORKS", '900 128px "Arial Black","Avenir Next",sans-serif', [1024, 200], 0, 2.2, [5.4, 1.05]);
  sign.position.set(0, 3.6, 11.9);
  sign.rotation.y = Math.PI;
  parent.add(sign);

  batch.box(m.trim, [6.4, 0.52, 10.6], [3.2, 1.04, 0.7]);
  batch.box(m.desk, [6.4, 1.06, 10.55], [3.34, 0.04, 0.86]);
  place(parent, new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: receptionTexture(), color: new THREE.Color(1.15, 1.15, 1.15) }), [6.4, 0.55, 10.24], [0, Math.PI, 0]);

  const cx = -6.2;
  batch.box(m.fabric, [cx, 0.22, 11.0], [2.6, 0.44, 0.9], 0, "#b5532f");
  batch.box(m.fabric, [cx, 0.68, 11.36], [2.6, 0.52, 0.22], 0, "#b5532f");
  for (const dx of [-1.3, 1.3]) batch.box(m.fabric, [cx + dx, 0.32, 11.0], [0.22, 0.62, 0.9], 0, "#9a4426");
  for (const dx of [-0.65, 0.65]) batch.box(m.fabric, [cx + dx, 0.5, 10.9], [1.22, 0.14, 0.72], 0, "#c8603a");
  batch.box(m.walnut, [cx, 0.4, 9.85], [1.2, 0.04, 0.6]);
  for (const [dx, dz] of [
    [-0.55, -0.25],
    [0.55, -0.25],
    [-0.55, 0.25],
    [0.55, 0.25],
  ] as const)
    batch.box(m.dark, [cx + dx, 0.2, 9.85 + dz], [0.04, 0.4, 0.04]);
  batch.box(m.tinted, [cx - 0.2, 0.43, 9.8], [0.3, 0.015, 0.22], 0.3, "#3ad4ff");
  batch.cylinder(m.dark, [-8.0, 0.75, 11.3], 0.015, 1.5);
  batch.add("cylinder", m.dark, { at: [-8.0, 0.02, 11.3], size: [0.18, 0.03, 0.18] });
  place(parent, new THREE.CylinderGeometry(0.16, 0.24, 0.32, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.9), side: THREE.DoubleSide }), [-8.0, 1.6, 11.3]);
}

function buildWallDecor(parent: THREE.Object3D, batch: ShapeBatch, m: Materials): void {
  batch.box(m.trim, [-14.97, 1.6, -5.4], [0.04, 1.42, 3.72]);
  place(parent, new THREE.PlaneGeometry(3.6, 1.3), venueMaterial({ map: whiteboardTexture(), roughness: 0.25 }), [-14.94, 1.6, -5.4], [0, Math.PI / 2, 0]);
  batch.box(m.steel, [-14.88, 0.88, -5.4], [0.1, 0.03, 3.4]);
  const banner = place(parent, new THREE.PlaneGeometry(8, 0.88), new THREE.MeshStandardMaterial({ map: bannerTexture(), transparent: true, alphaTest: 0.1, roughness: 0.8, side: THREE.DoubleSide }), [-14.9, 3.72, -5.2], [0, Math.PI / 2, 0]);
  banner.renderOrder = 2;
  place(parent, new THREE.PlaneGeometry(0.9, 1.24), venueMaterial({ map: posterTexture(), roughness: 0.5 }), [-14.95, 1.8, -1.0], [0, Math.PI / 2, 0]);
  batch.box(m.tinted, [-14.97, 1.65, -9.4], [0.04, 1.0, 1.6], 0, "#a8814f");
  for (let i = 0; i < 7; i += 1) {
    batch.box(m.tinted, [-14.94, 1.4 + rnd() * 0.5, -10.0 + rnd() * 1.2], [0.01, 0.18, 0.16], 0, ["#fff27a", "#ff9ec7", "#9be8ff", "#ffffff"][i % 4]);
  }
}

function buildPlants(parent: THREE.Object3D, batch: ShapeBatch, m: Materials): void {
  const leaves: ShapePlacement[] = [];
  const greens = ["#2f7a3e", "#3d8f4a", "#276b3a", "#4a9a52"];
  for (const [x, z, height] of plantSpots) {
    batch.add("cylinder", m.ceramic, { at: [x, 0.26, z], size: [0.27, 0.52, 0.27] });
    batch.add("cylinder", m.dark, { at: [x, 0.53, z], size: [0.24, 0.02, 0.24] });
    batch.cylinder(m.walnut, [x, 0.5 + height * 0.35, z], 0.025, height * 0.7);
    const clusters = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < clusters; i += 1) {
      const angle = rnd() * TAU;
      const spread = i === 0 ? 0 : 0.18 + rnd() * 0.12;
      const radius = 0.24 + rnd() * 0.14;
      leaves.push({
        at: [x + Math.cos(angle) * spread, 0.55 + height * (0.55 + rnd() * 0.45), z + Math.sin(angle) * spread],
        size: [radius, radius * 1.25, radius],
        turn: rnd() * TAU,
        color: greens[i % greens.length]!,
      });
    }
  }
  const leafGeometry = new THREE.IcosahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(leafGeometry, m.leaf, leaves.length);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  leaves.forEach((leaf, i) => {
    matrix.compose(new THREE.Vector3(...leaf.at), quaternion.setFromEuler(euler.set(0, leaf.turn ?? 0, 0)), new THREE.Vector3(...leaf.size));
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(leaf.color!));
  });
  mesh.computeBoundingSphere();
  parent.add(mesh);
}

function buildCeiling(parent: THREE.Object3D): Pick<OfficeParts, "panels" | "partyPanels" | "panelCenters"> {
  const placements: ShapePlacement[] = [];
  const partyPanels: boolean[] = [];
  const panelCenters: THREE.Vector2[] = [];
  for (const x of [-12, -8, -4, 0, 4, 8, 12]) {
    for (const z of [-9.6, -6, -2.6, 0.8, 4.4, 8, 10.9]) {
      placements.push({ at: [x, H - 0.025, z], size: [1.2, 0.04, 0.6], color: "#ffffff" });
      partyPanels.push(Math.abs(x) <= 4 && z <= 1);
      panelCenters.push(new THREE.Vector2(x, z));
    }
  }
  const panels = instancedShapes(parent, "box", new THREE.MeshBasicMaterial({ color: 0xffffff }), placements);
  return { panels, partyPanels, panelCenters };
}

function buildStringLights(parent: THREE.Object3D): Pick<OfficeParts, "bulbs" | "bulbStrand"> {
  const bulbsPerStrand = 24;
  const strands = [-7.6, -4.6, -1.6, 1.4];
  const placements: ShapePlacement[] = [];
  const bulbStrand: number[] = [];
  const wire: number[] = [];
  const point = (t: number, z: number): Triple => [THREE.MathUtils.lerp(-6.4, 6.4, t), H - 0.12 - 0.75 * 4 * t * (1 - t), z + Math.sin(t * Math.PI * 3) * 0.12];
  strands.forEach((z, strand) => {
    for (let i = 0; i <= 40; i += 1) {
      const a = point(i / 40, z);
      const b = point((i + 1) / 40, z);
      if (i < 40) wire.push(...a, ...b);
    }
    for (let i = 0; i < bulbsPerStrand; i += 1) {
      const [x, y, bz] = point((i + 0.5) / bulbsPerStrand, z);
      placements.push({ at: [x, y - 0.05, bz], size: [0.045, 0.06, 0.045], color: "#ffffff" });
      bulbStrand.push(strand);
    }
  });
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wire, 3));
  parent.add(new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
  const bulbs = instancedShapes(parent, "ball", new THREE.MeshBasicMaterial({ color: 0xffffff }), placements);
  return { bulbs, bulbStrand };
}

function buildBalloons(parent: THREE.Object3D): Pick<OfficeParts, "balloons" | "balloonRest"> {
  const colors = ["#ff4fa3", "#ffb84a", "#3ad4ff", "#8a5cff", "#5be37a", "#ffffff"];
  const anchors: Triple[] = [
    [-1.45, 1.05, -9.55],
    [1.45, 1.05, -9.55],
    [8.6, 0.78, 5.85],
    [12.6, 0.78, 7.15],
    [4.95, 1.08, 10.3],
    [-9.0, 0.76, -6.6],
    [12.0, 0.76, -1.7],
    [-12.0, 0.76, 2.5],
    [-10.0, 0.94, 6.85],
  ];
  const rest: ShapePlacement[] = [];
  const strings: number[] = [];
  anchors.forEach((anchor, a) => {
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * TAU + a;
      const top: Triple = [anchor[0] + Math.cos(angle) * 0.22, anchor[1] + 1.05 + rnd() * 0.45, anchor[2] + Math.sin(angle) * 0.22];
      rest.push({ at: top, size: [0.2, 0.25, 0.2], color: colors[(a + i * 2) % colors.length]! });
      strings.push(...anchor, top[0], top[1] - 0.25, top[2]);
    }
  });
  const stringGeometry = new THREE.BufferGeometry();
  stringGeometry.setAttribute("position", new THREE.Float32BufferAttribute(strings, 3));
  parent.add(new THREE.LineSegments(stringGeometry, new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.5 })));
  const balloons = instancedShapes(parent, "ball", venueMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.05 }), rest);
  return { balloons, balloonRest: rest };
}

function buildDiscoBall(parent: THREE.Object3D): THREE.Mesh {
  place(parent, new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }), [0, H - 0.45, -3.2]);
  return place(parent, new THREE.IcosahedronGeometry(0.42, 2), metalMaterial("#9aa2b0", { roughness: 0.2, flatShading: true, envMapIntensity: 1.1 }), [0, H - 1.32, -3.2]);
}

export function buildOffice(parent: THREE.Object3D, neon: NeonPalette, wallColor: string): OfficeParts {
  const m = materials(wallColor);
  const batch = new ShapeBatch();
  buildShell(parent, batch, m);
  const stage = buildStageWall(parent, batch, m, neon);
  const monitors = buildDeskPods(parent, batch, m);
  buildMeetingNook(parent, batch, m);
  buildPantry(parent, batch, m);
  buildFrontOfHouse(parent, batch, m, neon);
  buildWallDecor(parent, batch, m);
  buildPlants(parent, batch, m);
  batch.build(parent);
  return {
    ...stage,
    monitors,
    ...buildCeiling(parent),
    ...buildStringLights(parent),
    ...buildBalloons(parent),
    discoBall: buildDiscoBall(parent),
  };
}
