import type { RoomMusicState } from "@nightpaws/shared";
import { fitText } from "../../engine/canvas-texture.ts";
import { fract, pawPath, TAU, type NeonPalette } from "./club-kit.ts";
import type { StageParts } from "./club-architecture.ts";

export class LedWall {
  private readonly context: CanvasRenderingContext2D;
  private readonly grid: CanvasPattern;
  private musicState: RoomMusicState | null = null;

  constructor(
    private readonly stage: StageParts,
    private readonly neon: NeonPalette,
  ) {
    this.context = stage.ledCanvas.getContext("2d")!;
    this.grid = this.context.createPattern(stage.ledGrid, "repeat")!;
  }

  showMusicState(state: RoomMusicState | null): void {
    this.musicState = state;
  }

  draw(time: number, beats: number, energy: number): void {
    const g = this.context;
    const W = this.stage.ledCanvas.width;
    const H = this.stage.ledCanvas.height;
    const c = this.neon.colors.map((color) => color.getStyle());
    const pulse = Math.pow(1 - fract(beats), 3) * (0.4 + 0.6 * energy);
    const sceneIndex = Math.floor(beats / 16) % 3;
    g.globalAlpha = 1;
    g.fillStyle = "#030106";
    g.fillRect(0, 0, W, H);
    if (sceneIndex === 0) {
      const horizon = H * 0.56;
      g.strokeStyle = c[2]!;
      g.lineWidth = 2;
      for (let i = 0; i < 14; i += 1) {
        const q = fract(i / 14 + beats * 0.25);
        const y = horizon + Math.pow(q, 2.2) * (H - horizon);
        g.globalAlpha = 0.25 + q * 0.6;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
      for (let i = -14; i <= 14; i += 1) {
        g.globalAlpha = 0.5;
        g.beginPath();
        g.moveTo(W / 2 + i * 10, horizon);
        g.lineTo(W / 2 + i * 70, H);
        g.stroke();
      }
      g.globalAlpha = 1;
      const r = 80 + pulse * 8;
      const sun = g.createLinearGradient(0, horizon - r * 2, 0, horizon);
      sun.addColorStop(0, c[3]!);
      sun.addColorStop(1, c[0]!);
      g.fillStyle = sun;
      g.beginPath();
      g.arc(W / 2, horizon, r, Math.PI, 0);
      g.fill();
      g.fillStyle = "#030106";
      for (let k = 0; k < 6; k += 1) g.fillRect(W / 2 - r, horizon - 10 - k * 13, r * 2, 2 + k);
    } else if (sceneIndex === 1) {
      g.save();
      g.translate(W / 2, H / 2);
      for (let i = 0; i < 12; i += 1) {
        const q = fract(i / 12 + beats * 0.125);
        const s = Math.pow(q, 2) * W * 0.9;
        g.rotate(0.05 + Math.sin(time * 0.3) * 0.02);
        g.strokeStyle = c[i % 4]!;
        g.globalAlpha = q;
        g.lineWidth = 2 + q * 10;
        g.strokeRect(-s / 2, -s / 3.2, s, s / 1.6);
      }
      g.restore();
      g.globalAlpha = 1;
    } else {
      g.save();
      g.translate(W / 2, H / 2);
      g.rotate(time * 0.3);
      for (let i = 0; i < 16; i += 1) {
        g.rotate(TAU / 16);
        g.fillStyle = c[i % 2 ? 0 : 2]!;
        g.globalAlpha = 0.35 + 0.3 * pulse;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(W, -40);
        g.lineTo(W, 40);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.globalAlpha = 1;
      g.strokeStyle = "#ffffff";
      g.lineWidth = 8;
      g.shadowColor = c[1]!;
      g.shadowBlur = 20;
      pawPath(g, W / 2, H / 2 - 4, 70 + pulse * 10);
      g.shadowBlur = 0;
    }
    for (let i = 0; i < 40; i += 1) {
      const level = 0.2 + 0.8 * Math.abs(Math.sin(i * 0.55 + time * 2.3) * Math.sin(i * 0.21 - time * 1.1 + beats * 0.5)) * (0.55 + 0.45 * pulse);
      const barHeight = level * 60 * (0.35 + 0.65 * energy);
      g.fillStyle = i % 2 ? c[1]! : c[0]!;
      g.fillRect(10 + i * 18.8, H - 6 - barHeight, 12, barHeight);
    }
    if (sceneIndex !== 2) this.drawNowPlaying(g, W, c);
    g.fillStyle = this.grid;
    g.fillRect(0, 0, W, H);
    this.stage.ledTexture.needsUpdate = true;
  }

  private drawNowPlaying(g: CanvasRenderingContext2D, W: number, c: string[]): void {
    const nowPlaying = this.musicState?.nowPlaying ?? null;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = 'italic 900 58px "Trebuchet MS","Avenir Next",sans-serif';
    g.shadowColor = c[1]!;
    g.shadowBlur = 18;
    g.fillStyle = "#ffffff";
    g.fillText("NIGHTPAWS", W / 2, 46);
    g.shadowBlur = 0;
    g.font = '800 19px "Avenir Next",Nunito,sans-serif';
    g.fillStyle = c[1]!;
    const headline = nowPlaying
      ? `♪ ${nowPlaying.request.title ?? `YouTube · ${nowPlaying.request.videoId}`}`
      : "DJ FINN · TAP ♪ REQUEST TO QUEUE A TRACK";
    g.fillText(fitText(g, headline.toUpperCase(), W - 40), W / 2, 88);
    if (nowPlaying) {
      g.font = '700 14px "Avenir Next",Nunito,sans-serif';
      g.fillStyle = c[3]!;
      const queued = this.musicState?.queue.length ?? 0;
      g.fillText(fitText(g, `REQUESTED BY ${nowPlaying.request.requestedBy.toUpperCase()}${queued ? ` · ${queued} UP NEXT` : ""}`, W - 40), W / 2, 110);
    }
  }
}
