import * as THREE from "three";

export const TAU = Math.PI * 2;
export const fract = (x: number) => x - Math.floor(x);
export const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export type Triple = [number, number, number];

export class SeededRandom {
  constructor(public seed: number) {}

  next(): number {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export const random = new SeededRandom(11);
export const rnd = () => random.next();

export interface ClubMood {
  name: string;
  bpm: number;
  colors: string[];
  ambient: string;
  ground: string;
  fog: string;
  fogDensity: number;
  bloom: number;
  wall: string;
  grade: Triple;
}

export const neonSynthMood: ClubMood = {
  name: "Neon Synth",
  bpm: 118,
  colors: ["#ff2bd6", "#22e6ff", "#7b2cff", "#ff5e8a"],
  ambient: "#4a2a78",
  ground: "#1a0a2a",
  fog: "#16052c",
  fogDensity: 0.017,
  bloom: 0.75,
  wall: "#5a3a70",
  grade: [1.0, 0.97, 1.04],
};

interface NeonOptions extends THREE.MeshBasicMaterialParameters {
  pulse?: number;
  flicker?: boolean;
}

interface NeonEntry {
  material: THREE.MeshBasicMaterial;
  index: number;
  multiplier: number;
  pulse: number;
  flicker: boolean;
}

export class NeonPalette {
  readonly colors: THREE.Color[];
  private readonly entries: NeonEntry[] = [];

  constructor(mood: ClubMood) {
    this.colors = mood.colors.map((color) => new THREE.Color(color));
  }

  material(index: number, multiplier = 2.2, options: NeonOptions = {}): THREE.MeshBasicMaterial {
    const { pulse = 0, flicker = false, ...parameters } = options;
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, ...parameters });
    this.entries.push({ material, index, multiplier, pulse, flicker });
    return material;
  }

  color(index: number): THREE.Color {
    return this.colors[((index % this.colors.length) + this.colors.length) % this.colors.length]!;
  }

  update(elapsedSeconds: number, pulse: number): void {
    for (const entry of this.entries) {
      let multiplier = entry.multiplier * (1 - entry.pulse * 0.45 + entry.pulse * 0.45 * pulse);
      if (entry.flicker && fract(elapsedSeconds * 0.23) > 0.93) multiplier *= Math.sin(elapsedSeconds * 90) > 0 ? 1 : 0.15;
      entry.material.color.copy(this.color(entry.index)).multiplyScalar(multiplier);
    }
  }

  dispose(): void {
    for (const entry of this.entries) {
      entry.material.map?.dispose();
      entry.material.dispose();
    }
  }
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
  repeat?: [number, number],
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

export function place(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position?: Triple | null,
  rotation?: Triple | null,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.matrixAutoUpdate = true;
  parent.add(mesh);
  return mesh;
}

export const dotTexture = canvasTexture(64, 64, (g, w, h) => {
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, w, h);
});

function neonSignTexture(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, width: number, height: number): THREE.CanvasTexture {
  return canvasTexture(width, height, (g) => {
    g.strokeStyle = "#fff";
    g.fillStyle = "#fff";
    g.lineJoin = "round";
    g.lineCap = "round";
    g.shadowColor = "#fff";
    for (const [blur, lineWidth, alpha] of [
      [40, 16, 0.35],
      [18, 10, 0.6],
      [4, 5, 1],
    ] as const) {
      g.shadowBlur = blur;
      g.lineWidth = lineWidth;
      g.globalAlpha = alpha;
      draw(g, width, height);
    }
  });
}

export function pawPath(g: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  g.beginPath();
  g.ellipse(cx, cy + size * 0.25, size * 0.42, size * 0.34, 0, 0, TAU);
  g.stroke();
  for (const [dx, dy, r] of [
    [-0.48, -0.25, 0.15],
    [-0.17, -0.55, 0.16],
    [0.17, -0.55, 0.16],
    [0.48, -0.25, 0.15],
  ] as const) {
    g.beginPath();
    g.ellipse(cx + dx * size, cy + dy * size, r * size, r * size * 1.25, dx * 0.5, 0, TAU);
    g.stroke();
  }
}

export function textSign(
  neon: NeonPalette,
  text: string,
  font: string,
  canvasSize: [number, number],
  colorIndex: number,
  multiplier: number,
  size: [number, number],
  flicker = false,
): THREE.Mesh {
  const texture = neonSignTexture(
    (g, w, h) => {
      g.font = font;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.strokeText(text, w / 2, h / 2);
    },
    canvasSize[0],
    canvasSize[1],
  );
  return new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    neon.material(colorIndex, multiplier, { map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, flicker }),
  );
}

export function iconSign(
  neon: NeonPalette,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  canvasSize: [number, number],
  colorIndex: number,
  multiplier: number,
  size: [number, number],
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    neon.material(colorIndex, multiplier, {
      map: neonSignTexture(draw, canvasSize[0], canvasSize[1]),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

export function curtainGeometry(width: number, height: number, folds: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height, folds * 10, 1);
  const positions = geometry.attributes.position!;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    positions.setZ(i, Math.sin((x / width + 0.5) * folds * TAU) * 0.14);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function muralTexture(seed: number, width = 1024, height = 512): THREE.CanvasTexture {
  return canvasTexture(width, height, (g) => {
    const saved = random.seed;
    random.seed = seed;
    g.scale(width / 1024, height / 512);
    const w = 1024;
    const h = 512;
    g.fillStyle = "#1d1824";
    g.fillRect(0, 0, w, h);
    const palette = ["#ff4fa3", "#22d3ee", "#ffd23f", "#7b2cff", "#5be37a", "#ff7a3d"];
    for (let i = 0; i < 26; i += 1) {
      g.strokeStyle = palette[i % palette.length]!;
      g.globalAlpha = 0.55 + rnd() * 0.4;
      g.lineWidth = 10 + rnd() * 40;
      g.lineCap = "round";
      g.beginPath();
      const x = rnd() * w;
      const y = rnd() * h;
      g.moveTo(x, y);
      g.bezierCurveTo(x + rnd() * 300 - 150, y + rnd() * 200 - 100, x + rnd() * 300 - 150, y + rnd() * 200 - 100, x + rnd() * 400 - 200, y + rnd() * 200 - 100);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.font = '900 210px "Arial Black","Avenir Next",sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 22;
    g.strokeStyle = "#0b0910";
    g.strokeText("PAWS", w / 2, h / 2 + 10);
    const gradient = g.createLinearGradient(0, h * 0.3, 0, h * 0.75);
    gradient.addColorStop(0, "#ffd23f");
    gradient.addColorStop(1, "#ff4fa3");
    g.fillStyle = gradient;
    g.fillText("PAWS", w / 2, h / 2 + 10);
    g.fillStyle = "#ffffff";
    g.globalAlpha = 0.9;
    for (let i = 0; i < 5; i += 1) {
      const cx = 80 + i * 210;
      const cy = 70 + (i % 2) * 380;
      g.beginPath();
      g.ellipse(cx, cy, 34, 28, 0, 0, TAU);
      g.fill();
      for (const [dx, dy] of [
        [-30, -40],
        [-10, -54],
        [10, -54],
        [30, -40],
      ] as const) {
        g.beginPath();
        g.ellipse(cx + dx, cy + dy, 11, 14, 0, 0, TAU);
        g.fill();
      }
    }
    random.seed = saved;
  });
}

const coneGeometry = new THREE.ConeGeometry(1, 1, 32, 1, true);
coneGeometry.translate(0, -0.5, 0);
coneGeometry.rotateX(-Math.PI / 2);

const beamShader = {
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 color; uniform float opacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ float a = pow(vUv.y, 1.7) * opacity; float rim = abs(dot(normalize(vN), normalize(vV))); a *= smoothstep(0.05, 0.85, rim); gl_FragColor = vec4(color, a); }`,
};

export type BeamMesh = THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>;

export function lightBeam(parent: THREE.Object3D, opacity: number): BeamMesh {
  const material = new THREE.ShaderMaterial({
    ...beamShader,
    uniforms: { color: { value: new THREE.Color() }, opacity: { value: opacity } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(coneGeometry, material);
  mesh.renderOrder = 5;
  parent.add(mesh);
  return mesh;
}

export function aimBeam(beam: BeamMesh, from: THREE.Vector3, to: THREE.Vector3, angle: number): void {
  beam.position.copy(from);
  beam.lookAt(to);
  const length = from.distanceTo(to) * 1.05;
  const radius = Math.tan(angle) * length * 0.95;
  beam.scale.set(radius, radius, length);
}
