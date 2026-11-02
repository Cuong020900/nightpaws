import type { RoomMusicState } from "@nightpaws/shared";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { fitText, LiveCanvasTexture } from "../../engine/canvas-texture.ts";
import { fract, type NeonPalette } from "./club-kit.ts";

const beatsPerScene = 16;
const sceneCount = 4;
const overlayScenes = new Set([0, 2]);

const vertexShader = `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uBeats;
uniform float uEnergy;
uniform float uPulse;
uniform float uAspect;
uniform float uOverlayMix;
uniform vec3 uColors[4];
uniform sampler2D uOverlay;
varying vec2 vUv;
#include <fog_pars_fragment>

#define TAU 6.28318530718
const vec2 cells = vec2(384.0, 160.0);
const float beatsPerScene = ${beatsPerScene.toFixed(1)};

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 palette(float t) {
  t = fract(t) * 4.0;
  float f = smoothstep(0.0, 1.0, fract(t));
  if (t < 1.0) return mix(uColors[0], uColors[1], f);
  if (t < 2.0) return mix(uColors[1], uColors[2], f);
  if (t < 3.0) return mix(uColors[2], uColors[3], f);
  return mix(uColors[3], uColors[0], f);
}

vec3 synthwave(vec2 p, float beats, float pulse) {
  float horizon = -0.1;
  float sky = clamp(p.y - horizon, 0.0, 1.0);
  vec3 col = mix(uColors[0] * 0.22, uColors[2] * 0.08, sqrt(sky * 2.0));
  vec2 starCell = floor(p * 70.0);
  float star = step(0.985, hash(starCell)) * step(horizon + 0.05, p.y);
  col += vec3(0.9) * star * (0.4 + 0.6 * sin(uTime * 3.0 + hash(starCell + 3.1) * TAU));
  vec2 sp = p - vec2(0.0, horizon + 0.12);
  float radius = 0.3 + 0.025 * pulse;
  float d = length(sp);
  float above = step(horizon, p.y);
  float band = sp.y < 0.06 ? step(0.0, sin((sp.y + uTime * 0.03) * 110.0) + 0.6 + sp.y * 14.0) : 1.0;
  float disc = smoothstep(radius, radius - 0.006, d) * above * band;
  vec3 sunColor = mix(uColors[0] * 1.4, vec3(2.0, 1.5, 0.55), clamp((sp.y + radius) / (radius * 2.0), 0.0, 1.0));
  col += uColors[0] * 0.9 * exp(-max(d - radius, 0.0) * 9.0) * above * (0.6 + 0.6 * pulse);
  col = mix(col, sunColor, disc);
  float ridge = horizon + 0.07 * abs(sin(p.x * 5.0 + 1.3)) * (0.6 + 0.4 * sin(p.x * 13.0)) + 0.02;
  float mountain = step(p.y, ridge) * above;
  col = mix(col, uColors[2] * 0.06, mountain);
  col += uColors[1] * 1.6 * smoothstep(0.004, 0.0, abs(p.y - ridge)) * above;
  if (p.y < horizon) {
    float depth = 0.16 / (horizon - p.y + 0.004);
    float gx = p.x * depth;
    float gz = depth + beats * 0.5;
    float lineX = abs(fract(gx * 1.2) - 0.5) / (fwidth(gx * 1.2) * 1.5 + 0.001);
    float lineZ = abs(fract(gz) - 0.5) / (fwidth(gz) * 1.5 + 0.001);
    float grid = 1.0 - min(min(lineX, lineZ), 1.0);
    float fade = clamp((horizon - p.y) * 4.0, 0.0, 1.0);
    col = uColors[2] * 0.05 + palette(0.25 + gz * 0.02) * grid * fade * (1.2 + 0.8 * pulse);
    col += uColors[0] * 0.5 * exp(-(horizon - p.y) * 18.0);
  }
  return col;
}

vec3 tunnel(vec2 p, float beats, float pulse) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float depth = 0.5 / max(r, 0.02) + beats * 0.5;
  float ring = smoothstep(0.34, 0.48, abs(fract(depth) - 0.5));
  float tiles = step(0.0, sin(a * 8.0 + floor(depth) * 1.7 + uTime * 0.4));
  float spokes = pow(0.5 + 0.5 * cos(a * 6.0 + depth * 0.9 - uTime * 0.7), 12.0);
  vec3 col = palette(floor(depth) * 0.25 + 0.1) * ring * (1.0 + 0.9 * pulse);
  col += palette(floor(depth) * 0.25 + 0.6) * tiles * 0.14;
  col += palette(depth * 0.05 + 0.5) * spokes * 0.7;
  col *= smoothstep(0.03, 0.4, r);
  col += uColors[1] * 0.8 * exp(-r * 14.0) * (0.3 + pulse);
  return col;
}

vec3 kaleidoscope(vec2 p, float beats, float pulse) {
  vec2 q = p * 1.7;
  float r = length(q);
  float a = atan(q.y, q.x) + uTime * 0.12;
  float segment = TAU / 8.0;
  a = mod(a, segment);
  a = abs(a - segment * 0.5);
  q = vec2(cos(a), sin(a)) * r;
  float v = sin(q.x * 9.0 - beats * TAU * 0.125) + sin(q.y * 15.0 + uTime * 0.8) + sin((q.x + q.y) * 7.0 + beats * 0.5) + sin(r * 12.0 - beats * TAU * 0.25);
  float lines = smoothstep(0.32, 0.0, abs(fract(v * 0.6) - 0.5));
  vec3 col = palette(v * 0.08 + r * 0.4 + beats / 32.0) * (0.12 + 1.5 * lines) * (0.75 + 0.6 * pulse);
  col *= smoothstep(1.6, 0.2, r);
  return col;
}

float pawShape(vec2 p) {
  float pad = length((p - vec2(0.0, -0.07)) / vec2(0.17, 0.135)) - 1.0;
  pad *= 0.135;
  float toe = min(min(length(p - vec2(-0.175, 0.1)), length(p - vec2(-0.065, 0.19))), min(length(p - vec2(0.065, 0.19)), length(p - vec2(0.175, 0.1)))) - 0.058;
  return min(pad, toe);
}

vec3 pawBurst(vec2 p, float beats, float pulse) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float rays = smoothstep(-0.15, 0.15, sin(a * 12.0 + uTime * 0.9));
  vec3 col = mix(uColors[2] * 0.08, uColors[0] * 0.35, rays) * (0.55 + 0.5 * pulse) * smoothstep(1.3, 0.1, r);
  float wave = fract(beats);
  col += palette(floor(beats) * 0.25) * 2.0 * smoothstep(0.018, 0.0, abs(r - wave * 1.3)) * (1.0 - wave);
  float wave2 = fract(beats - 0.5);
  col += palette(floor(beats) * 0.25 + 0.5) * 0.8 * smoothstep(0.01, 0.0, abs(r - wave2 * 1.3)) * (1.0 - wave2);
  vec2 pawP = p / (1.0 + 0.1 * pulse);
  float paw = pawShape(pawP);
  col += uColors[1] * 0.7 * exp(-abs(paw) * 80.0);
  col = mix(col, vec3(0.78, 0.74, 0.82), smoothstep(0.005, 0.0, paw));
  return col;
}

vec3 sceneColor(float index, vec2 p, float beats, float pulse) {
  if (index < 0.5) return synthwave(p, beats, pulse);
  if (index < 1.5) return kaleidoscope(p, beats, pulse);
  if (index < 2.5) return pawBurst(p, beats, pulse);
  return tunnel(p, beats, pulse);
}

void main() {
  vec2 uv = (floor(vUv * cells) + 0.5) / cells;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float beats = uBeats;
  float pulse = uPulse;
  float sceneBeat = mod(beats, beatsPerScene);
  float index = mod(floor(beats / beatsPerScene), ${sceneCount.toFixed(1)});
  vec3 col = sceneColor(index, p, beats, pulse);
  float blend = smoothstep(beatsPerScene - 1.0, beatsPerScene, sceneBeat);
  if (blend > 0.0) col = mix(col, sceneColor(mod(index + 1.0, ${sceneCount.toFixed(1)}), p, beats, pulse), blend);

  float column = floor(uv.x * 56.0);
  float level = 0.2 + 0.8 * abs(sin(column * 0.55 + uTime * 2.3) * sin(column * 0.21 - uTime * 1.1 + beats * 0.5)) * (0.55 + 0.45 * pulse);
  float barHeight = level * 0.2 * (0.35 + 0.65 * uEnergy);
  float inBar = step(fract(uv.x * 56.0), 0.72) * step(uv.y, 0.025 + barHeight) * step(0.025, uv.y);
  col = mix(col, mix(uColors[1], uColors[0], uv.y / 0.25) * 1.5, inBar * 0.9);

  vec2 overlayUv = (vUv - vec2(0.12, 0.66)) / vec2(0.76, 0.3);
  if (uOverlayMix > 0.0 && all(greaterThanEqual(overlayUv, vec2(0.0))) && all(lessThanEqual(overlayUv, vec2(1.0)))) {
    vec4 text = texture2D(uOverlay, overlayUv);
    col = mix(col, col * 0.2, min(text.a * 1.6, 1.0) * 0.6 * uOverlayMix);
    col = mix(col, text.rgb * 1.05, text.a * uOverlayMix);
  }

  float strobe = pow(1.0 - fract(beats / 4.0), 14.0) * uEnergy;
  col += palette(beats / 16.0) * strobe * 0.35;
  col += uColors[1] * 0.12 * smoothstep(0.03, 0.0, abs(fract(vUv.y - uTime * 0.11) - 0.5));
  col *= 0.72 + 0.23 * uEnergy;

  vec2 cell = fract(vUv * cells) - 0.5;
  float led = smoothstep(0.5, 0.32, max(abs(cell.x), abs(cell.y)));
  vec2 footprint = fwidth(vUv * cells);
  float resolve = clamp(1.6 - max(footprint.x, footprint.y) * 1.6, 0.0, 1.0);
  col *= mix(0.9, mix(0.5, 1.12, led), resolve);

  vec2 edge = min(vUv, 1.0 - vUv) * vec2(uAspect, 1.0);
  col *= smoothstep(0.0, 0.04, min(edge.x, edge.y)) * 0.25 + 0.75;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export class VjScreen {
  private readonly material: THREE.ShaderMaterial;
  private readonly overlay = new LiveCanvasTexture(1024, 256);
  private readonly glow: THREE.RectAreaLight;
  private readonly glowColor = new THREE.Color();
  private readonly nextColor = new THREE.Color();
  private musicState: RoomMusicState | null = null;
  private overlayMix = 0;

  constructor(
    screen: THREE.Mesh<THREE.PlaneGeometry>,
    private readonly neon: NeonPalette,
  ) {
    RectAreaLightUniformsLib.init();
    const { width, height } = screen.geometry.parameters;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBeats: { value: 0 },
          uEnergy: { value: 0 },
          uPulse: { value: 0 },
          uAspect: { value: width / height },
          uOverlayMix: { value: 0 },
          uColors: { value: neon.colors },
          uOverlay: { value: this.overlay.texture },
        },
      ]),
      vertexShader,
      fragmentShader,
      fog: true,
    });
    this.material.uniforms.uColors!.value = neon.colors;
    this.material.uniforms.uOverlay!.value = this.overlay.texture;
    (screen.material as THREE.Material).dispose();
    screen.material = this.material;

    this.glow = new THREE.RectAreaLight(0xffffff, 0, width, height);
    this.glow.position.copy(screen.position).add(new THREE.Vector3(0, 0, 0.05));
    this.glow.lookAt(screen.position.x, screen.position.y, screen.position.z + 1);
    screen.parent?.add(this.glow);
    this.paintOverlay();
  }

  showMusicState(state: RoomMusicState | null): void {
    this.musicState = state;
    this.paintOverlay();
  }

  update(time: number, deltaSeconds: number, beats: number, energy: number, pulse: number): void {
    const uniforms = this.material.uniforms;
    uniforms.uTime!.value = time;
    uniforms.uBeats!.value = beats;
    uniforms.uEnergy!.value = energy;
    uniforms.uPulse!.value = pulse;

    const sceneIndex = Math.floor(beats / beatsPerScene) % sceneCount;
    const showOverlay = overlayScenes.has(sceneIndex) && beats % beatsPerScene < beatsPerScene - 1.5;
    this.overlayMix = THREE.MathUtils.damp(this.overlayMix, showOverlay ? 1 : 0, 4, deltaSeconds);
    uniforms.uOverlayMix!.value = this.overlayMix;

    const blend = THREE.MathUtils.smoothstep(beats % beatsPerScene, beatsPerScene - 1, beatsPerScene);
    this.glowColor.copy(this.neon.color(sceneIndex * 3)).lerp(this.nextColor.copy(this.neon.color((sceneIndex + 1) * 3)), blend);
    this.glowColor.lerp(this.neon.color(Math.floor(beats)), 0.25 * fract(beats * 0.5));
    this.glow.color.copy(this.glowColor);
    this.glow.intensity = (1.6 + 3.2 * pulse) * (0.55 + 0.45 * energy);
  }

  dispose(): void {
    this.overlay.dispose();
    this.material.dispose();
    this.glow.removeFromParent();
  }

  private paintOverlay(): void {
    const nowPlaying = this.musicState?.nowPlaying ?? null;
    const queued = this.musicState?.queue.length ?? 0;
    const glowStyle = this.neon.color(1).getStyle();
    const accentStyle = this.neon.color(3).getStyle();
    this.overlay.repaint((g, width) => {
      g.clearRect(0, 0, width, 256);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = 'italic 900 118px "Trebuchet MS","Avenir Next",sans-serif';
      g.shadowColor = glowStyle;
      g.shadowBlur = 26;
      g.fillStyle = "#ffffff";
      g.fillText("NIGHTPAWS", width / 2, 80);
      g.shadowBlur = 10;
      g.font = '800 38px "Avenir Next",Nunito,sans-serif';
      g.fillStyle = glowStyle;
      const headline = nowPlaying
        ? `♪ ${nowPlaying.request.title ?? `YouTube · ${nowPlaying.request.videoId}`}`
        : "DJ FINN · TAP ♪ REQUEST TO QUEUE A TRACK";
      g.fillText(fitText(g, headline.toUpperCase(), width - 60), width / 2, 172);
      if (nowPlaying) {
        g.font = '700 28px "Avenir Next",Nunito,sans-serif';
        g.fillStyle = accentStyle;
        g.fillText(fitText(g, `REQUESTED BY ${nowPlaying.request.requestedBy.toUpperCase()}${queued ? ` · ${queued} UP NEXT` : ""}`, width - 60), width / 2, 222);
      }
      g.shadowBlur = 0;
    });
  }
}
