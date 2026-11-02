import * as THREE from "three";
import { clothMaterial, environmentMap, metalMaterial, venueMaterial } from "../../engine/shading.ts";
import {
  canvasTexture,
  curtainGeometry,
  dotTexture,
  iconSign,
  muralTexture,
  pawPath,
  place,
  rnd,
  TAU,
  textSign,
  V2,
  V3,
  type NeonPalette,
} from "./club-kit.ts";

export const roomHeight = 9;

export interface RoomParts {
  wallMaterial: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
}

export function buildRoom(parent: THREE.Object3D, neon: NeonPalette): RoomParts {
  const concrete = canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#16121c";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i += 1) {
        const v = (18 + rnd() * 18) | 0;
        g.fillStyle = `rgba(${v + 10},${v + 4},${v + 18},0.5)`;
        g.fillRect(rnd() * w, rnd() * h, 2, 2);
      }
      g.strokeStyle = "rgba(0,0,0,0.6)";
      g.lineWidth = 3;
      for (let x = 0; x <= w; x += 256) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
        g.beginPath();
        g.moveTo(0, x);
        g.lineTo(w, x);
        g.stroke();
      }
    },
    [8, 7],
  );
  place(parent, new THREE.PlaneGeometry(32, 27), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.32, metalness: 0.25 }), [0, 0, -0.5], [-Math.PI / 2, 0, 0]);
  const brick = canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#26222a";
      g.fillRect(0, 0, w, h);
      const bh = 32;
      const bw = 96;
      for (let r = 0; r < h / bh; r += 1) {
        const offset = ((r % 2) * bw) / 2;
        for (let x = -bw; x < w + bw; x += bw) {
          g.fillStyle = `hsl(${320 + rnd() * 40},9%,${28 + rnd() * 16}%)`;
          g.fillRect(x + offset + 3, r * bh + 3, bw - 6, bh - 6);
        }
      }
    },
    [6, 2.2],
  );
  const wallMaterial = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.92, color: 0x5a3a70 });
  const H = roomHeight;
  place(parent, new THREE.PlaneGeometry(32, H), wallMaterial, [0, H / 2, -14]);
  place(parent, new THREE.PlaneGeometry(27, H), wallMaterial, [-16, H / 2, -0.5], [0, Math.PI / 2, 0]);
  place(parent, new THREE.PlaneGeometry(27, H), wallMaterial, [16, H / 2, -0.5], [0, -Math.PI / 2, 0]);
  place(parent, new THREE.PlaneGeometry(13.8, H), wallMaterial, [-9.1, H / 2, 13], [0, Math.PI, 0]);
  place(parent, new THREE.PlaneGeometry(13.8, H), wallMaterial, [9.1, H / 2, 13], [0, Math.PI, 0]);
  place(parent, new THREE.PlaneGeometry(4.4, 5.6), wallMaterial, [0, 6.2, 13], [0, Math.PI, 0]);
  place(parent, new THREE.PlaneGeometry(32, 27), new THREE.MeshStandardMaterial({ color: 0x08060c, roughness: 1 }), [0, H, -0.5], [Math.PI / 2, 0, 0]);
  const steel = new THREE.MeshStandardMaterial({ color: 0x24242c, metalness: 0.8, roughness: 0.4, envMap: environmentMap(), envMapIntensity: 0.25 });
  for (const [x, z] of [
    [-15.75, -13.75],
    [15.75, -13.75],
    [-15.75, 2.0],
    [15.75, 5.8],
    [-15.75, 12.75],
    [15.75, 12.75],
    [-15.75, -10.2],
    [15.75, -10.2],
  ] as const)
    place(parent, new THREE.BoxGeometry(0.4, H, 0.4), steel, [x, H / 2, z]);
  for (const z of [-10, -4, 2, 8]) place(parent, new THREE.BoxGeometry(32, 0.4, 0.28), steel, [0, H - 0.25, z]);
  const strip = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) =>
    place(parent, new THREE.BoxGeometry(w, h, d), material, [x, y, z]);
  strip(0.06, 0.06, 27, -15.94, 0.14, -0.5, neon.material(0, 2.2));
  strip(0.06, 0.06, 27, 15.94, 0.14, -0.5, neon.material(1, 2.2));
  strip(32, 0.06, 0.06, 0, 8.6, -13.94, neon.material(0, 2.4));
  strip(0.06, 0.06, 27, -15.94, 8.6, -0.5, neon.material(2, 2.2));
  strip(0.06, 0.06, 27, 15.94, 8.6, -0.5, neon.material(2, 2.2));
  return { wallMaterial, steel };
}

export interface StageParts {
  ledCanvas: HTMLCanvasElement;
  ledTexture: THREE.CanvasTexture;
  ledGrid: HTMLCanvasElement;
  decks: THREE.Mesh[];
  mixerLeds: THREE.Mesh[];
  speakerRings: THREE.Mesh[];
}

export function buildStage(parent: THREE.Object3D, neon: NeonPalette, steel: THREE.Material): StageParts {
  const env = environmentMap();
  const stageTop = venueMaterial({ color: 0x0b0a10, roughness: 0.18, metalness: 0.2, envMap: env, envMapIntensity: 0.4 });
  const stageSide = new THREE.MeshStandardMaterial({ color: 0x120e18, roughness: 0.6 });
  place(parent, new THREE.BoxGeometry(19, 1.1, 4.6), [stageSide, stageSide, stageTop, stageSide, stageSide, stageSide], [0, 0.55, -11.7]);
  place(parent, new THREE.CylinderGeometry(3.2, 3.2, 1.1, 48, 1, false, -Math.PI / 2, Math.PI), [stageSide, stageTop, stageSide], [0, 0.55, -9.4]);
  place(parent, new THREE.TorusGeometry(3.22, 0.035, 8, 64, Math.PI), neon.material(1, 2.6, { pulse: 0.5 }), [0, 1.08, -9.4], [Math.PI / 2, 0, 0]);
  for (const sx of [-1, 1]) place(parent, new THREE.BoxGeometry(6.3, 0.05, 0.05), neon.material(0, 2.6, { pulse: 0.5 }), [sx * 6.35, 1.07, -9.38]);
  const ledCanvas = document.createElement("canvas");
  ledCanvas.width = 512;
  ledCanvas.height = 214;
  const ledTexture = new THREE.CanvasTexture(ledCanvas);
  ledTexture.colorSpace = THREE.SRGBColorSpace;
  place(parent, new THREE.PlaneGeometry(17.6, 7.3), new THREE.MeshBasicMaterial({ map: ledTexture, color: new THREE.Color(1.15, 1.15, 1.15) }), [0, 4.8, -13.92]);
  const ledGrid = document.createElement("canvas");
  ledGrid.width = 6;
  ledGrid.height = 6;
  const gridContext = ledGrid.getContext("2d")!;
  gridContext.fillStyle = "rgba(0,0,0,0.62)";
  gridContext.fillRect(4, 0, 2, 6);
  gridContext.fillRect(0, 4, 6, 2);
  const gold = metalMaterial("#b8913a", { roughness: 0.35 });
  for (const sx of [-1, 1]) place(parent, new THREE.BoxGeometry(0.55, 7.9, 0.55), gold, [sx * 9.1, 5.05, -13.55]);
  place(parent, new THREE.BoxGeometry(18.75, 0.55, 0.55), gold, [0, 8.75, -13.55]);
  const velvet = venueMaterial({ color: 0x5e0a1c, roughness: 0.92, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) place(parent, curtainGeometry(3.4, 7.9, 6), velvet, [sx * 11.0, 5.05, -13.1]);
  place(parent, curtainGeometry(25, 1.15, 26), velvet, [0, 8.45, -12.95]);
  const desk = venueMaterial({ color: 0x15101c, roughness: 0.35, metalness: 0.4, envMap: env, envMapIntensity: 0.4 });
  place(parent, new THREE.BoxGeometry(3.4, 0.75, 0.9), desk, [0, 1.475, -8.05]);
  const grille = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = "#0a0810";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    for (let x = 12; x < w; x += 22) g.fillRect(x, 14, 8, h - 28);
  });
  place(parent, new THREE.PlaneGeometry(3.2, 0.55), neon.material(2, 1.6, { map: grille, pulse: 0.6 }), [0, 1.475, -7.59]);
  const decks: THREE.Mesh[] = [];
  const vinyl = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.3, metalness: 0.5 });
  const plinth = new THREE.MeshStandardMaterial({ color: 0x2a2a34, metalness: 0.6, roughness: 0.4 });
  for (const x of [-1.0, 1.0]) {
    place(parent, new THREE.BoxGeometry(0.85, 0.06, 0.72), plinth, [x, 1.88, -8.05]);
    place(parent, new THREE.CylinderGeometry(0.31, 0.31, 0.03, 28), vinyl, [x, 1.925, -8.05]);
    const label = place(parent, new THREE.CylinderGeometry(0.1, 0.1, 0.035, 18), neon.material(x < 0 ? 0 : 1, 1.8), [x, 1.93, -8.05]);
    place(label, new THREE.BoxGeometry(0.04, 0.036, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0, 0.002, 0.16]);
    decks.push(label);
  }
  place(parent, new THREE.BoxGeometry(0.75, 0.08, 0.66), new THREE.MeshStandardMaterial({ color: 0x1f1f28, metalness: 0.6, roughness: 0.35 }), [0, 1.89, -8.05]);
  const mixerLeds: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i += 1) mixerLeds.push(place(parent, new THREE.BoxGeometry(0.06, 0.03, 0.06), neon.material(i % 3, 2.5), [-0.25 + i * 0.1, 1.94, -7.85]));
  for (const sx of [-1, 1]) {
    place(parent, new THREE.CylinderGeometry(0.75, 0.8, 0.6, 32), desk, [sx * 5.8, 1.4, -11.6]);
    place(parent, new THREE.TorusGeometry(0.76, 0.03, 8, 48), neon.material(0, 2.8, { pulse: 1 }), [sx * 5.8, 1.71, -11.6], [Math.PI / 2, 0, 0]);
  }
  const cabinet = new THREE.MeshStandardMaterial({ color: 0x0d0b12, roughness: 0.7 });
  const speakerRings: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      const box = place(parent, new THREE.BoxGeometry(1.3, 0.42, 0.9), cabinet, [sx * 9.9, 8.1 - i * 0.44, -9.4]);
      box.rotation.x = 0.06 * i;
    }
    place(parent, new THREE.BoxGeometry(0.05, 2.0, 0.05), steel, [sx * 9.9, 8.6, -9.4]);
    place(parent, new THREE.BoxGeometry(1.5, 0.95, 1.0), cabinet, [sx * 7.6, 0.475, -8.9]);
    speakerRings.push(place(parent, new THREE.TorusGeometry(0.34, 0.025, 8, 32), neon.material(sx < 0 ? 0 : 1, 2.4, { pulse: 1 }), [sx * 7.6, 0.48, -8.38]));
  }
  return { ledCanvas, ledTexture, ledGrid, decks, mixerLeds, speakerRings };
}

export interface DanceFloorTile {
  i: number;
  j: number;
  distance: number;
}

export interface DanceFloorParts {
  tiles: THREE.InstancedMesh;
  layout: DanceFloorTile[];
}

export function buildDanceFloor(parent: THREE.Object3D, neon: NeonPalette): DanceFloorParts {
  const NX = 13;
  const NZ = 9;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.94, 0.06, 0.94), new THREE.MeshBasicMaterial({ color: 0xffffff }), NX * NZ);
  const layout: DanceFloorTile[] = [];
  const matrix = new THREE.Matrix4();
  const black = new THREE.Color(0, 0, 0);
  let n = 0;
  for (let i = 0; i < NX; i += 1)
    for (let j = 0; j < NZ; j += 1) {
      matrix.makeTranslation(-6 + i, 0.04, -5.5 + j);
      tiles.setMatrixAt(n, matrix);
      tiles.setColorAt(n, black);
      layout.push({ i, j, distance: Math.hypot(i - 6, j - 4) });
      n += 1;
    }
  parent.add(tiles);
  const env = environmentMap();
  place(parent, new THREE.BoxGeometry(13.3, 0.04, 9.3), new THREE.MeshStandardMaterial({ color: 0x07060a, metalness: 0.7, roughness: 0.3 }), [0, 0.02, -1.5]);
  place(
    parent,
    new THREE.PlaneGeometry(13.1, 9.1),
    venueMaterial({ color: 0x000000, roughness: 0.08, transparent: true, opacity: 0.3, envMap: env, envMapIntensity: 0.3 }),
    [0, 0.08, -1.5],
    [-Math.PI / 2, 0, 0],
  );
  const ring = neon.material(1, 2.4);
  for (const [w, d, x, z] of [
    [13.4, 0.06, 0, -6.05],
    [13.4, 0.06, 0, 3.05],
    [0.06, 9.1, -6.65, -1.5],
    [0.06, 9.1, 6.65, -1.5],
  ] as const)
    place(parent, new THREE.BoxGeometry(w, 0.07, d), ring, [x, 0.06, z]);
  const podium = venueMaterial({ color: 0x14101c, roughness: 0.3, metalness: 0.5, envMap: env, envMapIntensity: 0.5 });
  for (const sx of [-1, 1]) {
    place(parent, new THREE.CylinderGeometry(0.9, 1.0, 1.2, 36), podium, [sx * 8.2, 0.6, -6.2]);
    place(parent, new THREE.TorusGeometry(0.9, 0.035, 8, 48), neon.material(2, 2.8, { pulse: 1 }), [sx * 8.2, 1.21, -6.2], [Math.PI / 2, 0, 0]);
    place(parent, new THREE.TorusGeometry(1.0, 0.035, 8, 48), neon.material(0, 2.4), [sx * 8.2, 0.05, -6.2], [Math.PI / 2, 0, 0]);
  }
  return { tiles, layout };
}

export interface ChandelierParts {
  group: THREE.Group;
  rings: { ring: THREE.Group; radius: number; index: number }[];
  cables: THREE.LineSegments;
  cablePositions: Float32Array;
}

export function buildChandelier(parent: THREE.Object3D, neon: NeonPalette): ChandelierParts {
  const group = new THREE.Group();
  group.position.set(0, 7.4, -1.5);
  parent.add(group);
  const rings: ChandelierParts["rings"] = [];
  const frame = metalMaterial("#2a2a32", { roughness: 0.35 });
  for (let i = 0; i < 5; i += 1) {
    const radius = 1.2 + i * 0.85;
    const ring = new THREE.Group();
    group.add(ring);
    place(ring, new THREE.TorusGeometry(radius, 0.07, 6, 64), frame, [0, 0, 0], [Math.PI / 2, 0, 0]);
    place(ring, new THREE.TorusGeometry(radius, 0.035, 6, 64), neon.material(i % 2 ? 1 : 0, 1.7, { pulse: 0.4 }), [0, -0.08, 0], [Math.PI / 2, 0, 0]);
    rings.push({ ring, radius, index: i });
  }
  const cablePositions = new Float32Array(5 * 3 * 2 * 3);
  const cableGeometry = new THREE.BufferGeometry();
  cableGeometry.setAttribute("position", new THREE.BufferAttribute(cablePositions, 3));
  const cables = new THREE.LineSegments(cableGeometry, new THREE.LineBasicMaterial({ color: 0x44404c, transparent: true, opacity: 0.6 }));
  cables.frustumCulled = false;
  parent.add(cables);
  return { group, rings, cables, cablePositions };
}

export function buildBar(parent: THREE.Object3D, neon: NeonPalette): void {
  const env = environmentMap();
  const wood = canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#1d1016";
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = `hsl(340,25%,${9 + rnd() * 6}%)`;
        g.fillRect(x + 1, 0, 14, h);
      }
    },
    [10, 1],
  );
  place(parent, new THREE.BoxGeometry(1.3, 1.1, 10), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 }), [-13.0, 0.55, -4.5]);
  place(parent, new THREE.BoxGeometry(1.75, 0.09, 10.4), venueMaterial({ color: 0x1a0f14, roughness: 0.12, metalness: 0.3, envMap: env, envMapIntensity: 0.5 }), [-13.0, 1.14, -4.5]);
  place(parent, new THREE.BoxGeometry(0.05, 0.05, 10), neon.material(0, 2.6), [-12.32, 0.1, -4.5]);
  place(parent, new THREE.BoxGeometry(0.05, 0.04, 10.3), neon.material(1, 2.2), [-12.14, 1.08, -4.5]);
  place(parent, new THREE.CylinderGeometry(0.03, 0.03, 10, 8), metalMaterial("#b8913a"), [-12.2, 0.32, -4.5], [Math.PI / 2, 0, 0]);
  const chrome = metalMaterial("#cfcfd8", { roughness: 0.25 });
  const leather = clothMaterial("#8a1035");
  for (const z of [-8.6, -7.4, -4.2, -3.0, -0.6]) {
    place(parent, new THREE.CylinderGeometry(0.28, 0.25, 0.12, 22), leather, [-11.65, 0.86, z]);
    place(parent, new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), chrome, [-11.65, 0.42, z]);
    place(parent, new THREE.TorusGeometry(0.18, 0.015, 6, 20), chrome, [-11.65, 0.32, z], [Math.PI / 2, 0, 0]);
    place(parent, new THREE.CylinderGeometry(0.22, 0.24, 0.035, 22), chrome, [-11.65, 0.02, z]);
  }
  const glass = venueMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45, roughness: 0.05, envMap: env });
  for (const z of [-8.1, -6.7, -5.0, -3.6, -1.2, 0.1]) place(parent, new THREE.CylinderGeometry(0.06, 0.05, 0.16, 12), glass, [-12.75 + rnd() * 0.4, 1.27, z]);
  const glow = canvasTexture(256, 128, (g, w, h) => {
    const gradient = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#2a2a2a");
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, h);
  });
  place(parent, new THREE.PlaneGeometry(9.6, 2.5), neon.material(1, 0.9, { map: glow }), [-15.96, 2.4, -4.5], [0, Math.PI / 2, 0]);
  place(parent, new THREE.BoxGeometry(0.7, 1.15, 9.8), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7 }), [-15.62, 0.575, -4.5]);
  const shelf = new THREE.MeshStandardMaterial({ color: 0x140c10, roughness: 0.5 });
  const profile = [
    [0.07, 0],
    [0.075, 0.02],
    [0.075, 0.2],
    [0.06, 0.26],
    [0.03, 0.3],
    [0.026, 0.4],
    [0.03, 0.41],
    [0, 0.41],
  ].map(([x, y]) => V2(x!, y!));
  const bottleGeometry = new THREE.LatheGeometry(profile, 12);
  const bottleColors = ["#c8781e", "#2f8a3a", "#cfe8f0", "#3050c0", "#a02030", "#7a2a9a", "#e0b030", "#1a6a60"];
  const bottleMaterials = bottleColors.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color).multiplyScalar(0.35),
        roughness: 0.12,
        transparent: true,
        opacity: 0.86,
        envMap: env,
        envMapIntensity: 0.6,
      }),
  );
  const slots: THREE.Matrix4[][] = bottleMaterials.map(() => []);
  for (const y of [1.45, 2.3, 3.15]) {
    place(parent, new THREE.BoxGeometry(0.42, 0.05, 9.4), shelf, [-15.72, y, -4.5]);
    let z = -9.0;
    while (z < 0.2) {
      const scale = 0.85 + rnd() * 0.6;
      slots[Math.floor(rnd() * bottleMaterials.length)]!.push(
        new THREE.Matrix4().compose(V3(-15.72 + (rnd() - 0.5) * 0.12, y + 0.025, z), new THREE.Quaternion(), V3(scale, scale * (0.9 + rnd() * 0.4), scale)),
      );
      z += 0.22 + rnd() * 0.22;
    }
  }
  slots.forEach((list, index) => {
    if (!list.length) return;
    const bottles = new THREE.InstancedMesh(bottleGeometry, bottleMaterials[index]!, list.length);
    list.forEach((matrix, slot) => bottles.setMatrixAt(slot, matrix));
    parent.add(bottles);
  });
  const sign = iconSign(
    neon,
    (g, w, h) => {
      g.font = 'italic 900 150px "Trebuchet MS","Avenir Next",sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.strokeText("Nightpaws", w * 0.56, h * 0.52);
      pawPath(g, w * 0.09, h * 0.52, 80);
    },
    [1024, 256],
    0,
    2.6,
    [7.2, 1.8],
  );
  sign.position.set(-15.9, 5.3, -4.5);
  sign.rotation.y = Math.PI / 2;
  parent.add(sign);
  const subtitle = textSign(neon, "COCKTAILS · OPEN LATE", '800 92px "Avenir Next","Trebuchet MS",sans-serif', [1024, 160], 1, 2.2, [4.6, 0.72], true);
  subtitle.position.set(-15.9, 4.15, -4.5);
  subtitle.rotation.y = Math.PI / 2;
  parent.add(subtitle);
}

export function buildBooth(parent: THREE.Object3D, x: number, y: number, z: number, rotationY: number, color: string): THREE.Group {
  const env = environmentMap();
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  parent.add(group);
  const leather = venueMaterial({ color, roughness: 0.42, envMap: env, envMapIntensity: 0.4 });
  place(group, new THREE.BoxGeometry(3.0, 0.45, 0.8), leather, [0, 0.25, -1.0]);
  place(group, new THREE.BoxGeometry(3.0, 0.75, 0.3), leather, [0, 0.82, -1.3]);
  for (let i = 0; i < 5; i += 1) place(group, new THREE.CapsuleGeometry(0.12, 0.4, 4, 10), leather, [-1.2 + i * 0.6, 0.85, -1.12]);
  for (const sx of [-1, 1]) {
    place(group, new THREE.BoxGeometry(0.8, 0.45, 2.0), leather, [sx * 1.1, 0.25, -0.1]);
    place(group, new THREE.BoxGeometry(0.3, 0.75, 2.0), leather, [sx * 1.4, 0.82, -0.1]);
  }
  const top = venueMaterial({ color: 0x0d0a10, roughness: 0.12, metalness: 0.3, envMap: env, envMapIntensity: 0.6 });
  place(group, new THREE.CylinderGeometry(0.62, 0.62, 0.05, 32), top, [0, 0.72, -0.1]);
  place(group, new THREE.CylinderGeometry(0.07, 0.25, 0.7, 12), metalMaterial("#b8913a"), [0, 0.36, -0.1]);
  place(group, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 0.6) }), [0, 0.79, -0.1]);
  return group;
}

export interface VipParts {
  sparkler: THREE.Points;
  sparkPositions: Float32Array;
  sparkSeeds: [number, number, number][];
}

export function buildVip(parent: THREE.Object3D, neon: NeonPalette): VipParts {
  const env = environmentMap();
  const platform = venueMaterial({ color: 0x110c16, roughness: 0.25, metalness: 0.3, envMap: env, envMapIntensity: 0.3 });
  place(parent, new THREE.BoxGeometry(6.4, 0.6, 14), platform, [12.8, 0.3, -2]);
  place(parent, new THREE.BoxGeometry(0.05, 0.05, 14), neon.material(3, 2.4), [9.58, 0.55, -2]);
  place(parent, new THREE.BoxGeometry(0.6, 0.3, 2.0), platform, [9.3, 0.15, 1.2]);
  const glass = venueMaterial({ color: 0xaad8ff, transparent: true, opacity: 0.14, roughness: 0.05, envMap: env, envMapIntensity: 0.8, side: THREE.DoubleSide });
  const brass = metalMaterial("#c9a24a", { roughness: 0.25 });
  for (const [z0, z1] of [
    [-9, 0.2],
    [2.2, 5],
  ] as const) {
    const length = z1 - z0;
    const center = (z0 + z1) / 2;
    place(parent, new THREE.BoxGeometry(0.03, 0.95, length), glass, [9.75, 1.08, center]);
    place(parent, new THREE.CylinderGeometry(0.035, 0.035, length, 10), brass, [9.75, 1.58, center], [Math.PI / 2, 0, 0]);
    const posts = Math.max(1, Math.round(length / 1.8));
    for (let k = 0; k <= posts; k += 1) place(parent, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), brass, [9.75, 1.1, z0 + (length * k) / posts]);
  }
  const rope = clothMaterial("#8a0f2c");
  const post = (x: number, z: number) => {
    place(parent, new THREE.CylinderGeometry(0.04, 0.04, 0.95, 10), brass, [x, 0.48, z]);
    place(parent, new THREE.SphereGeometry(0.07, 12, 8), brass, [x, 0.98, z]);
    place(parent, new THREE.CylinderGeometry(0.17, 0.19, 0.04, 18), brass, [x, 0.02, z]);
  };
  const swag = (from: THREE.Vector3, to: THREE.Vector3) => {
    const middle = from.clone().add(to).multiplyScalar(0.5);
    middle.y -= 0.22;
    place(parent, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, middle, to), 16, 0.025, 6, false), rope);
  };
  post(8.9, 0.2);
  post(8.9, 2.2);
  swag(V3(8.9, 0.9, 0.2), V3(8.9, 0.9, 2.2));
  for (const z of [-7.2, -3.4, 0.6, 3.8]) buildBooth(parent, 14.6, 0.6, z, -Math.PI / 2, "#3b0f4a");
  const bucket = metalMaterial("#d6d8e0", { roughness: 0.2 });
  const bottle = venueMaterial({ color: 0x14341c, roughness: 0.1, envMap: env });
  for (const z of [-7.2, -3.4, 0.6]) {
    place(parent, new THREE.CylinderGeometry(0.16, 0.12, 0.22, 16, 1, true), bucket, [14.7, 1.47, z + 0.2]);
    place(parent, new THREE.CylinderGeometry(0.05, 0.05, 0.38, 10), bottle, [14.7, 1.6, z + 0.25], [0.2, 0, 0]);
  }
  const vipSign = textSign(neon, "VIP", 'italic 900 200px "Trebuchet MS","Avenir Next",sans-serif', [512, 256], 3, 2.8, [2.6, 1.3]);
  vipSign.position.set(15.92, 4.6, -1.6);
  vipSign.rotation.y = -Math.PI / 2;
  parent.add(vipSign);
  const crown = iconSign(
    neon,
    (g, w, h) => {
      g.beginPath();
      g.moveTo(w * 0.15, h * 0.75);
      g.lineTo(w * 0.85, h * 0.75);
      g.lineTo(w * 0.92, h * 0.3);
      g.lineTo(w * 0.68, h * 0.52);
      g.lineTo(w * 0.5, h * 0.2);
      g.lineTo(w * 0.32, h * 0.52);
      g.lineTo(w * 0.08, h * 0.3);
      g.closePath();
      g.stroke();
    },
    [256, 256],
    2,
    2.6,
    [1.3, 1.3],
  );
  crown.position.set(15.92, 4.6, -3.6);
  crown.rotation.y = -Math.PI / 2;
  parent.add(crown);
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(120 * 3);
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparkler = new THREE.Points(
    sparkGeometry,
    new THREE.PointsMaterial({ size: 0.05, map: dotTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.4, 1.9, 1.2) }),
  );
  sparkler.position.set(14.7, 1.8, -3.15);
  sparkler.frustumCulled = false;
  parent.add(sparkler);
  const sparkSeeds = Array.from({ length: 120 }, () => [rnd() * TAU, rnd(), 0.4 + rnd() * 0.6] as [number, number, number]);
  return { sparkler, sparkPositions, sparkSeeds };
}

export function buildEntrance(parent: THREE.Object3D, neon: NeonPalette, steel: THREE.Material): void {
  const env = environmentMap();
  const street = canvasTexture(256, 256, (g, w, h) => {
    const gradient = g.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#1a1440");
    gradient.addColorStop(1, "#3a1846");
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i += 1) {
      g.fillStyle = `hsla(${rnd() * 360},90%,70%,${0.15 + rnd() * 0.4})`;
      g.beginPath();
      g.arc(rnd() * w, rnd() * h * 0.8, 4 + rnd() * 14, 0, TAU);
      g.fill();
    }
  });
  place(parent, new THREE.PlaneGeometry(4.4, 3.4), new THREE.MeshBasicMaterial({ map: street, color: new THREE.Color(1.2, 1.2, 1.2) }), [0, 1.7, 13.6], [0, Math.PI, 0]);
  const frame = metalMaterial("#1c1c22", { roughness: 0.35 });
  for (const sx of [-1, 1]) place(parent, new THREE.BoxGeometry(0.25, 3.5, 0.6), frame, [sx * 2.32, 1.75, 13.0]);
  place(parent, new THREE.BoxGeometry(4.9, 0.25, 0.6), frame, [0, 3.52, 13.0]);
  for (const sx of [-1, 1]) place(parent, new THREE.BoxGeometry(0.05, 3.5, 0.05), neon.material(0, 2.6), [sx * 2.5, 1.75, 12.66]);
  place(parent, new THREE.BoxGeometry(5.05, 0.05, 0.05), neon.material(0, 2.6), [0, 3.68, 12.66]);
  const welcome = textSign(neon, "WELCOME IN", '800 90px "Avenir Next","Trebuchet MS",sans-serif', [1024, 160], 1, 2.4, [2.8, 0.44]);
  welcome.position.set(0, 3.9, 12.7);
  welcome.rotation.y = Math.PI;
  parent.add(welcome);
  place(parent, new THREE.BoxGeometry(32, 0.32, 2.8), new THREE.MeshStandardMaterial({ color: 0x0e0b12, roughness: 0.7 }), [0, 4.3, 11.6]);
  place(parent, new THREE.BoxGeometry(32, 0.05, 0.05), neon.material(2, 2.6), [0, 4.12, 10.22]);
  const glass = venueMaterial({ color: 0xaad8ff, transparent: true, opacity: 0.12, roughness: 0.05, envMap: env, side: THREE.DoubleSide });
  place(parent, new THREE.BoxGeometry(32, 1.0, 0.03), glass, [0, 4.96, 10.25]);
  place(parent, new THREE.CylinderGeometry(0.04, 0.04, 32, 10), metalMaterial("#c9a24a"), [0, 5.46, 10.25], [0, 0, Math.PI / 2]);
  for (const x of [-11.5, -5.5, 5.5, 11.5]) place(parent, new THREE.BoxGeometry(0.32, 4.15, 0.32), steel, [x, 2.07, 10.3]);
  const balcony = textSign(neon, "NIGHTPAWS", 'italic 900 170px "Trebuchet MS","Avenir Next",sans-serif', [1024, 220], 0, 2.6, [5.2, 1.1]);
  balcony.position.set(0, 4.95, 10.2);
  balcony.rotation.y = Math.PI;
  parent.add(balcony);
  const host = venueMaterial({ color: 0x1a1220, roughness: 0.3, envMap: env, envMapIntensity: 0.4 });
  place(parent, new THREE.BoxGeometry(0.9, 1.15, 0.5), host, [3.4, 0.575, 11.2]);
  place(parent, new THREE.BoxGeometry(0.9, 0.04, 0.5), neon.material(1, 2.2), [3.4, 1.17, 11.2]);
  place(parent, new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.8) }), [3.6, 1.3, 11.1]);
  const brass = metalMaterial("#c9a24a", { roughness: 0.25 });
  const rope = clothMaterial("#8a0f2c");
  for (const sx of [-1, 1]) {
    const zs = [12.4, 10.8, 9.2];
    for (const z of zs) {
      place(parent, new THREE.CylinderGeometry(0.04, 0.04, 0.95, 10), brass, [sx * 1.8, 0.48, z]);
      place(parent, new THREE.SphereGeometry(0.07, 12, 8), brass, [sx * 1.8, 0.98, z]);
      place(parent, new THREE.CylinderGeometry(0.17, 0.19, 0.04, 18), brass, [sx * 1.8, 0.02, z]);
    }
    for (let i = 0; i < 2; i += 1) {
      const from = V3(sx * 1.8, 0.9, zs[i]!);
      const to = V3(sx * 1.8, 0.9, zs[i + 1]!);
      const middle = from.clone().add(to).multiplyScalar(0.5);
      middle.y -= 0.22;
      place(parent, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, middle, to), 16, 0.025, 6, false), rope);
    }
  }
  place(parent, new THREE.BoxGeometry(4.2, 1.1, 0.8), host, [13.6, 0.55, 11.3]);
  place(parent, new THREE.BoxGeometry(4.2, 0.04, 0.8), neon.material(3, 2.0), [13.6, 1.12, 11.3]);
  place(parent, new THREE.CylinderGeometry(0.025, 0.025, 4, 8), metalMaterial("#c0c0c8"), [13.6, 2.1, 12.5], [0, 0, Math.PI / 2]);
  const coatColors = ["#2a2a35", "#6a2a3a", "#2a4a6a", "#4a4a2a", "#5a3a6a", "#1a1a1a"];
  for (let i = 0; i < 9; i += 1) place(parent, new THREE.BoxGeometry(0.08, 0.9, 0.5), clothMaterial(coatColors[i % coatColors.length]!), [11.9 + i * 0.4, 1.62, 12.5]);
  const coat = textSign(neon, "COAT CHECK", '800 96px "Avenir Next","Trebuchet MS",sans-serif', [1024, 160], 3, 2.2, [2.6, 0.4]);
  coat.position.set(15.92, 2.9, 11.3);
  coat.rotation.y = -Math.PI / 2;
  parent.add(coat);
}

export function buildDecor(parent: THREE.Object3D): void {
  place(parent, new THREE.PlaneGeometry(6.4, 2.6), new THREE.MeshStandardMaterial({ map: muralTexture(101, 512, 256), roughness: 0.85 }), [-15.95, 3.4, 6.5], [0, Math.PI / 2, 0]);
  place(parent, new THREE.PlaneGeometry(4.2, 3.0), new THREE.MeshStandardMaterial({ map: muralTexture(202, 512, 340), roughness: 0.85 }), [15.95, 2.4, 7.9], [0, -Math.PI / 2, 0]);
  const cord = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const shade = metalMaterial("#b8913a", { side: THREE.DoubleSide });
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.8) });
  for (const [x, z] of [
    [-14.2, 4.6],
    [-14.2, 8.4],
  ] as const) {
    place(parent, new THREE.CylinderGeometry(0.008, 0.008, 4.2, 4), cord, [x + 0.1, 6.9, z]);
    place(parent, new THREE.ConeGeometry(0.3, 0.32, 20, 1, true), shade, [x + 0.1, 4.7, z]);
    place(parent, new THREE.SphereGeometry(0.09, 12, 8), bulb, [x + 0.1, 4.55, z]);
  }
}
