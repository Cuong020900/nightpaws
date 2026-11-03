import * as THREE from "three";
import { createCanvasTexture } from "../../engine/canvas-texture.ts";
import { venueMaterial } from "../../engine/shading.ts";

export type BubbleKind = "dots0" | "dots1" | "dots2" | "laugh" | "idea";

export const talkingFrames: BubbleKind[] = ["dots0", "dots1", "dots2"];

function paintBubble(context: CanvasRenderingContext2D, width: number, height: number, kind: BubbleKind): void {
  const body = height - 34;
  context.beginPath();
  context.roundRect(10, 8, width - 20, body - 8, 46);
  context.moveTo(width * 0.36, body - 2);
  context.lineTo(width * 0.3, height - 6);
  context.lineTo(width * 0.52, body - 2);
  context.closePath();
  context.fillStyle = "rgba(255, 252, 244, 0.96)";
  context.fill();
  context.lineWidth = 7;
  context.strokeStyle = "#1c1a26";
  context.stroke();
  const middle = (body + 8) / 2;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (kind === "laugh" || kind === "idea") {
    context.font = '900 64px Nunito, "Arial Black", system-ui, sans-serif';
    context.fillStyle = kind === "laugh" ? "#ff4fa3" : "#e89a1a";
    context.fillText(kind === "laugh" ? "HA HA" : "!!", width / 2, middle + 4);
    return;
  }
  const lit = Number(kind.slice(4));
  for (let i = 0; i < 3; i += 1) {
    context.beginPath();
    context.arc(width / 2 + (i - 1) * 58, middle, i === lit ? 21 : 16, 0, Math.PI * 2);
    context.fillStyle = i === lit ? "#2a8fd6" : "#9aa3b8";
    context.fill();
  }
}

export class OfficeProps {
  private readonly bubbleMaterials = new Map<BubbleKind, THREE.SpriteMaterial>();
  private readonly cupGeometry = new THREE.CylinderGeometry(0.095, 0.075, 0.21, 14);
  private readonly drinkGeometry = new THREE.CircleGeometry(0.082, 14).rotateX(-Math.PI / 2).translate(0, 0.107, 0);
  private readonly cupMaterials = ["#f4f1ea", "#d6283c", "#1f4fbf", "#ffb84a"].map((color) => venueMaterial({ color, roughness: 0.4 }));
  private readonly drinkMaterials = [venueMaterial({ color: "#9fd8ff", roughness: 0.1 }), venueMaterial({ color: "#5a3420", roughness: 0.2 })];

  bubbleMaterial(kind: BubbleKind): THREE.SpriteMaterial {
    let material = this.bubbleMaterials.get(kind);
    if (!material) {
      const texture = createCanvasTexture(256, 176, (context, width, height) => paintBubble(context, width, height, kind));
      material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, color: new THREE.Color(0.8, 0.8, 0.8) });
      this.bubbleMaterials.set(kind, material);
    }
    return material;
  }

  bubble(): THREE.Sprite {
    const sprite = new THREE.Sprite(this.bubbleMaterial("dots0"));
    sprite.scale.set(0.5, 0.34, 1);
    sprite.renderOrder = 11;
    sprite.visible = false;
    return sprite;
  }

  cup(variant: number): THREE.Group {
    const cup = new THREE.Group();
    cup.add(new THREE.Mesh(this.cupGeometry, this.cupMaterials[variant % this.cupMaterials.length]!));
    cup.add(new THREE.Mesh(this.drinkGeometry, this.drinkMaterials[0]!));
    return cup;
  }

  fill(cup: THREE.Group, coffee: boolean): void {
    (cup.children[1] as THREE.Mesh).material = this.drinkMaterials[coffee ? 1 : 0]!;
  }

  dispose(): void {
    for (const material of this.bubbleMaterials.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.cupGeometry.dispose();
    this.drinkGeometry.dispose();
    for (const material of [...this.cupMaterials, ...this.drinkMaterials]) material.dispose();
  }
}
