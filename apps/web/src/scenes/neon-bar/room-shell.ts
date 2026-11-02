import * as THREE from "three";
import { createCanvasTexture } from "../../engine/canvas-texture.ts";
import { neonMaterial } from "../../engine/materials.ts";

export const roomSize = { width: 24, depth: 18, height: 6 } as const;

function paintFloorTiles(context: CanvasRenderingContext2D, width: number, height: number): void {
  const tiles = 8;
  const tileSize = width / tiles;
  for (let row = 0; row < tiles; row += 1) {
    for (let column = 0; column < tiles; column += 1) {
      const dark = (row + column) % 2 === 0;
      context.fillStyle = dark ? "#1b1426" : "#241a33";
      context.fillRect(column * tileSize, row * tileSize, tileSize, tileSize);
    }
  }
  context.strokeStyle = "rgba(160, 110, 255, 0.12)";
  context.lineWidth = 3;
  for (let line = 0; line <= tiles; line += 1) {
    context.beginPath();
    context.moveTo(line * tileSize, 0);
    context.lineTo(line * tileSize, height);
    context.moveTo(0, line * tileSize);
    context.lineTo(width, line * tileSize);
    context.stroke();
  }
}

function paintBrickWall(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "#170f24";
  context.fillRect(0, 0, width, height);
  const brickHeight = 32;
  const brickWidth = 96;
  for (let row = 0; row * brickHeight < height; row += 1) {
    const shift = row % 2 === 0 ? 0 : brickWidth / 2;
    for (let x = -brickWidth; x < width + brickWidth; x += brickWidth) {
      const shade = 26 + ((row * 7 + x) % 5) * 3;
      context.fillStyle = `rgb(${shade + 8}, ${shade - 6}, ${shade + 22})`;
      context.fillRect(x + shift + 3, row * brickHeight + 3, brickWidth - 6, brickHeight - 6);
    }
  }
  const glow = context.createLinearGradient(0, 0, 0, height);
  glow.addColorStop(0, "rgba(255, 46, 136, 0.18)");
  glow.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  glow.addColorStop(1, "rgba(38, 240, 255, 0.12)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function createWall(width: number, height: number, texture: THREE.Texture): THREE.Mesh {
  const wallTexture = texture.clone();
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(width / 4, height / 4);
  wallTexture.needsUpdate = true;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.9, metalness: 0 }),
  );
  return wall;
}

function createNeonStrip(length: number, color: string): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, 0.06), neonMaterial(color, 3));
}

export function createRoomShell(): THREE.Group {
  const shell = new THREE.Group();
  shell.name = "room-shell";
  const { width, depth, height } = roomSize;

  const floorTexture = createCanvasTexture(512, 512, paintFloorTiles);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(width / 8, depth / 8);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.35, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  shell.add(floor);

  const brickTexture = createCanvasTexture(512, 512, paintBrickWall);
  const walls = [
    { length: width, position: new THREE.Vector3(0, height / 2, -depth / 2), rotationY: 0, neonTrim: true },
    { length: width, position: new THREE.Vector3(0, height / 2, depth / 2), rotationY: Math.PI, neonTrim: false },
    { length: depth, position: new THREE.Vector3(-width / 2, height / 2, 0), rotationY: Math.PI / 2, neonTrim: true },
    { length: depth, position: new THREE.Vector3(width / 2, height / 2, 0), rotationY: -Math.PI / 2, neonTrim: true },
  ];
  for (const wallSpec of walls) {
    const wall = createWall(wallSpec.length, height, brickTexture);
    wall.position.copy(wallSpec.position);
    wall.rotation.y = wallSpec.rotationY;
    shell.add(wall);
    if (!wallSpec.neonTrim) continue;

    const inward = new THREE.Vector3(0, 0, 0.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), wallSpec.rotationY);
    const topStrip = createNeonStrip(wallSpec.length - 0.2, "#ff2e88");
    topStrip.position.copy(wallSpec.position).add(inward).setY(height - 0.15);
    topStrip.rotation.y = wallSpec.rotationY;
    const baseStrip = createNeonStrip(wallSpec.length - 0.2, "#26f0ff");
    baseStrip.position.copy(wallSpec.position).add(inward).setY(0.12);
    baseStrip.rotation.y = wallSpec.rotationY;
    shell.add(topStrip, baseStrip);
  }

  const trussMaterial = new THREE.MeshStandardMaterial({ color: "#2a2438", metalness: 0.8, roughness: 0.35 });
  for (const z of [-5, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 0.18, 0.18), trussMaterial);
    beam.position.set(0, 5.35, z);
    shell.add(beam);
  }
  for (const x of [-7, 7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 6.2), trussMaterial);
    rail.position.set(x, 5.35, -2);
    shell.add(rail);
  }

  return shell;
}
