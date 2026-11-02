import type { FloorRect, RoomMusicState } from "@nightpaws/shared";
import * as THREE from "three";
import { CharacterActor } from "../../actors/character-actor.ts";
import { createCanvasTexture, fitText, LiveCanvasTexture } from "../../engine/canvas-texture.ts";
import { neonMaterial } from "../../engine/materials.ts";
import type { SceneFrame } from "../scene-module.ts";

const screenRepaintInterval = 1 / 15;
const equalizerBars = 32;

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = fitText(context, `${lines[maxLines - 1]} …`, maxWidth);
  }
  return lines;
}

export class DjBooth {
  readonly object = new THREE.Group();
  readonly obstacle: FloorRect;
  readonly dj: CharacterActor;
  private readonly screen = new LiveCanvasTexture(1024, 576);
  private readonly speakerCones: THREE.Mesh[] = [];
  private musicState: RoomMusicState | null = null;
  private sinceRepaint = screenRepaintInterval;

  constructor(backWallZ: number) {
    this.object.name = "dj-booth";
    const platformDepth = 2.6;
    const platformFrontZ = backWallZ + platformDepth;
    this.obstacle = { minX: -3, maxX: 3, minZ: backWallZ, maxZ: platformFrontZ + 0.2 };

    const darkMetal = new THREE.MeshStandardMaterial({ color: "#1d1729", metalness: 0.6, roughness: 0.4 });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, platformDepth), darkMetal);
    platform.position.set(0, 0.2, backWallZ + platformDepth / 2);
    const platformEdge = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.05), neonMaterial("#26f0ff", 3));
    platformEdge.position.set(0, 0.4, platformFrontZ);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.9), darkMetal);
    desk.position.set(0, 0.85, platformFrontZ - 0.6);
    const deskFront = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 0.8),
      new THREE.MeshBasicMaterial({ map: this.createDeskFrontTexture(), toneMapped: false }),
    );
    deskFront.position.set(0, 0.85, platformFrontZ - 0.14);
    this.object.add(platform, platformEdge, desk, deskFront);

    const vinylMaterial = new THREE.MeshStandardMaterial({ color: "#0b0b10", roughness: 0.3 });
    for (const x of [-1, 1]) {
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 28), vinylMaterial);
      deck.position.set(x, 1.33, platformFrontZ - 0.6);
      deck.name = "turntable";
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), neonMaterial(x < 0 ? "#ff2e88" : "#ffd23f", 2));
      label.position.copy(deck.position).add(new THREE.Vector3(0, 0.01, 0));
      this.object.add(deck, label);
    }

    for (const x of [-4.1, 4.1]) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.6, 1.1), darkMetal);
      cabinet.position.set(x, 1.3, backWallZ + 0.8);
      this.object.add(cabinet);
      for (const y of [0.75, 1.85]) {
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24),
          new THREE.MeshStandardMaterial({ color: "#2c2440", metalness: 0.3, roughness: 0.6 }),
        );
        cone.rotation.x = Math.PI / 2;
        cone.position.set(x, y, backWallZ + 1.37);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.03, 8, 32), neonMaterial("#9b5cff", 2.6));
        ring.position.set(x, y, backWallZ + 1.4);
        this.speakerCones.push(cone);
        this.object.add(cone, ring);
      }
    }

    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.9, 0.12), darkMetal);
    screenFrame.position.set(0, 3.35, backWallZ + 0.07);
    const screenSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 4.5),
      new THREE.MeshBasicMaterial({ map: this.screen.texture, toneMapped: false }),
    );
    screenSurface.position.set(0, 3.35, backWallZ + 0.14);
    const screenGlow = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.05, 0.05), neonMaterial("#ff2e88", 3));
    screenGlow.position.set(0, 5.83, backWallZ + 0.14);
    this.object.add(screenFrame, screenSurface, screenGlow);

    this.dj = new CharacterActor({
      name: "DJ Whiskers",
      appearance: { characterTypeId: "fox", outfitId: "midnight-violet" },
      labelAccent: "#ffd23f",
    });
    this.dj.position.set(0, 0.4, platformFrontZ - 1.35);
    this.dj.facing = 0;
    this.object.add(this.dj.object);
  }

  showMusicState(state: RoomMusicState | null): void {
    this.musicState = state;
    this.sinceRepaint = screenRepaintInterval;
  }

  update(frame: SceneFrame): void {
    const { music } = frame;
    if (music.isPlaying && !this.dj.isDancing) this.dj.dance("dance-bounce");
    if (!music.isPlaying && this.dj.isDancing) this.dj.stopDancing();
    this.dj.update(frame.deltaSeconds, { elapsedSeconds: frame.elapsedSeconds, beats: music.beats });

    const thump = 1 + music.energy * 0.12 * Math.pow(1 - (music.beats % 1), 3);
    for (const cone of this.speakerCones) cone.scale.set(thump, 1, thump);

    for (const node of this.object.children) {
      if (node.name === "turntable") node.rotation.y += frame.deltaSeconds * music.energy * 3.5;
    }

    this.sinceRepaint += frame.deltaSeconds;
    if (this.sinceRepaint >= screenRepaintInterval) {
      this.sinceRepaint = 0;
      this.paintScreen(frame);
    }
  }

  dispose(): void {
    this.screen.dispose();
    this.dj.dispose();
  }

  private createDeskFrontTexture(): THREE.CanvasTexture {
    return createCanvasTexture(512, 128, (context, width, height) => {
      context.fillStyle = "#0d0818";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "#26f0ff";
      context.lineWidth = 6;
      context.strokeRect(6, 6, width - 12, height - 12);
      context.font = "64px Bungee, Impact, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.shadowColor = "#ff2e88";
      context.shadowBlur = 18;
      context.fillStyle = "#ff8cc6";
      context.fillText("DJ PAWS", width / 2, height / 2 + 4);
    });
  }

  private paintScreen({ elapsedSeconds, music }: SceneFrame): void {
    const nowPlaying = this.musicState?.nowPlaying ?? null;
    const queue = this.musicState?.queue ?? [];
    this.screen.repaint((context, width, height) => {
      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#1a0636");
      background.addColorStop(1, "#04121f");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.globalAlpha = 0.18;
      context.strokeStyle = "#9b5cff";
      context.lineWidth = 2;
      for (let x = 0; x < width; x += 48) {
        context.beginPath();
        context.moveTo(x + ((elapsedSeconds * 30) % 48), 0);
        context.lineTo(x + ((elapsedSeconds * 30) % 48) - 200, height);
        context.stroke();
      }
      context.globalAlpha = 1;

      const barWidth = width / equalizerBars;
      for (let index = 0; index < equalizerBars; index += 1) {
        const wobble = Math.abs(Math.sin(elapsedSeconds * (2.1 + (index % 5) * 0.7) + index * 0.9));
        const beatKick = Math.pow(1 - (music.beats % 1), 2);
        const level = music.isPlaying ? 0.2 + wobble * 0.55 + beatKick * 0.25 : 0.04 + wobble * 0.05;
        const barHeight = level * height * 0.42;
        const hue = 290 + (index / equalizerBars) * 110;
        context.fillStyle = `hsla(${hue}, 100%, 62%, 0.85)`;
        context.fillRect(index * barWidth + 4, height - barHeight, barWidth - 8, barHeight);
      }

      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.shadowColor = "#ff2e88";
      context.shadowBlur = 24;
      context.fillStyle = "#ff5fa8";
      context.font = "54px Bungee, Impact, sans-serif";
      context.fillText(nowPlaying ? "NOW PLAYING" : "DJ BOOTH OPEN", 56, 104);

      context.shadowColor = "#26f0ff";
      context.shadowBlur = 12;
      context.fillStyle = "#ffffff";
      context.font = "900 58px Nunito, system-ui, sans-serif";
      const headline = nowPlaying
        ? (nowPlaying.request.title ?? `YouTube · ${nowPlaying.request.videoId}`)
        : "Tap ♪ Request to queue a YouTube track";
      wrapLines(context, headline, width - 112, 2).forEach((line, index) => {
        context.fillText(line, 56, 190 + index * 66);
      });

      context.shadowBlur = 0;
      context.font = "800 34px Nunito, system-ui, sans-serif";
      context.fillStyle = "#9ff6ff";
      if (nowPlaying) context.fillText(`requested by ${nowPlaying.request.requestedBy}`, 56, 330);
      const nextUp = queue[0];
      if (nextUp) {
        context.fillStyle = "#ffd23f";
        context.fillText(
          fitText(context, `Up next: ${nextUp.title ?? nextUp.videoId} (+${queue.length - 1} more)`, width - 112),
          56,
          376,
        );
      }
    });
  }
}
