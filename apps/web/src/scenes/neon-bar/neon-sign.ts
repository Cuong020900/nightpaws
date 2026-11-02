import * as THREE from "three";
import { createCanvasTexture } from "../../engine/canvas-texture.ts";

export interface NeonSignOptions {
  text: string;
  color: string;
  glow: string;
  width: number;
  font?: string;
}

export function createNeonSign({ text, color, glow, width, font = "Bungee, Impact, sans-serif" }: NeonSignOptions): THREE.Mesh {
  const canvasWidth = 1024;
  const canvasHeight = 256;
  const texture = createCanvasTexture(canvasWidth, canvasHeight, (context) => {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.font = `150px ${font}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const fontSize = Math.min(150, (150 * (canvasWidth - 80)) / context.measureText(text).width);
    context.font = `${fontSize}px ${font}`;
    for (const blur of [40, 22, 10]) {
      context.shadowColor = glow;
      context.shadowBlur = blur;
      context.fillStyle = color;
      context.fillText(text, canvasWidth / 2, canvasHeight / 2);
    }
    context.shadowBlur = 0;
    context.fillStyle = "#ffffff";
    context.globalAlpha = 0.65;
    context.fillText(text, canvasWidth / 2, canvasHeight / 2);
  });
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false });
  material.color.setScalar(1.8);
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material);
}
