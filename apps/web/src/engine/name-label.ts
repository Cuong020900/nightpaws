import * as THREE from "three";
import { createCanvasTexture, fitText, roundedRectPath } from "./canvas-texture.ts";

export interface NameLabelStyle {
  accent: string;
  highlighted?: boolean;
}

export function createNameLabel(name: string, style: NameLabelStyle): THREE.Sprite {
  const width = 512;
  const height = 128;
  const texture = createCanvasTexture(width, height, (context) => {
    context.font = "900 58px Nunito, system-ui, sans-serif";
    const text = fitText(context, name, width - 90);
    const textWidth = context.measureText(text).width;
    const pillWidth = textWidth + 70;
    const pillX = (width - pillWidth) / 2;

    roundedRectPath(context, pillX, 18, pillWidth, 88, 44);
    context.fillStyle = "rgba(12, 6, 26, 0.78)";
    context.fill();
    context.lineWidth = style.highlighted ? 8 : 5;
    context.strokeStyle = style.accent;
    context.stroke();

    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, 64);
  });

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.renderOrder = 10;
  return sprite;
}
