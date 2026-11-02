import type { FloorRect } from "@nightpaws/shared";
import * as THREE from "three";
import type { SceneFrame } from "../scene-module.ts";

const floorPalette = ["#ff2e88", "#26f0ff", "#ffd23f", "#9b5cff", "#3dff8a"].map((hex) => new THREE.Color(hex));

export class DanceFloor {
  readonly object: THREE.InstancedMesh;
  readonly area: FloorRect;
  private readonly tileColor = new THREE.Color();
  private readonly idleColor = new THREE.Color("#2a1550");

  constructor(
    center: THREE.Vector2,
    private readonly tilesPerSide: number,
  ) {
    const tileSize = 1;
    const half = (tilesPerSide * tileSize) / 2;
    this.area = { minX: center.x - half, maxX: center.x + half, minZ: center.y - half, maxZ: center.y + half };

    const geometry = new THREE.BoxGeometry(tileSize * 0.94, 0.06, tileSize * 0.94);
    const material = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.object = new THREE.InstancedMesh(geometry, material, tilesPerSide * tilesPerSide);
    this.object.name = "dance-floor";

    const placement = new THREE.Matrix4();
    for (let row = 0; row < tilesPerSide; row += 1) {
      for (let column = 0; column < tilesPerSide; column += 1) {
        const index = row * tilesPerSide + column;
        placement.makeTranslation(
          this.area.minX + (column + 0.5) * tileSize,
          0.03,
          this.area.minZ + (row + 0.5) * tileSize,
        );
        this.object.setMatrixAt(index, placement);
        this.object.setColorAt(index, this.idleColor);
      }
    }
  }

  update({ elapsedSeconds, music }: SceneFrame): void {
    const beat = Math.floor(music.beats);
    const beatFraction = music.beats - beat;
    const pulse = 1 - beatFraction;
    const middle = (this.tilesPerSide - 1) / 2;

    for (let row = 0; row < this.tilesPerSide; row += 1) {
      for (let column = 0; column < this.tilesPerSide; column += 1) {
        const index = row * this.tilesPerSide + column;
        const ring = Math.round(Math.max(Math.abs(row - middle), Math.abs(column - middle)));
        const checker = (row + column + beat) % 2 === 0;
        const partyColor = floorPalette[(ring + beat) % floorPalette.length]!;
        const partyBrightness = (checker ? 0.8 : 0.25) * (0.5 + pulse * 0.5);

        const idleWave = 0.4 + 0.25 * Math.sin(elapsedSeconds * 1.2 - ring * 0.9);
        this.tileColor.copy(this.idleColor).multiplyScalar(idleWave * 1.6);
        this.tileColor.lerp(partyColor.clone().multiplyScalar(partyBrightness), music.energy);
        this.object.setColorAt(index, this.tileColor);
      }
    }
    this.object.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    this.object.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
  }
}
