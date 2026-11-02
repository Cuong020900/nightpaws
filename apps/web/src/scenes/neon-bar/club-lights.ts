import * as THREE from "three";
import { createCanvasTexture } from "../../engine/canvas-texture.ts";
import { beamMaterial, neonMaterial } from "../../engine/materials.ts";
import type { SceneFrame } from "../scene-module.ts";

const beamPalette = ["#ff2e88", "#26f0ff", "#9b5cff", "#ffd23f", "#3dff8a", "#ff6a3d"];

interface MovingHead {
  mount: THREE.Vector3;
  light: THREE.SpotLight;
  beam: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  beamPivot: THREE.Object3D;
  lens: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  colorOffset: number;
}

const beamLength = 7;
const beamAngle = 0.24;

export class ClubLights {
  readonly object = new THREE.Group();
  private readonly heads: MovingHead[] = [];
  private readonly mirrorBall: THREE.Mesh;
  private readonly sweepCenter: THREE.Vector3;
  private sweepTime = 0;
  private readonly workingColor = new THREE.Color();

  constructor(mountPoints: THREE.Vector3[], sweepCenter: THREE.Vector3) {
    this.object.name = "club-lights";
    this.sweepCenter = sweepCenter.clone();

    const housingMaterial = new THREE.MeshStandardMaterial({ color: "#16121f", metalness: 0.7, roughness: 0.4 });
    const beamGeometry = new THREE.ConeGeometry(Math.tan(beamAngle) * beamLength, beamLength, 24, 1, true);
    beamGeometry.translate(0, -beamLength / 2, 0);
    beamGeometry.rotateX(-Math.PI / 2);

    mountPoints.forEach((mount, index) => {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.42, 14), housingMaterial);
      housing.position.copy(mount).add(new THREE.Vector3(0, 0.12, 0));
      this.object.add(housing);

      const light = new THREE.SpotLight("#ffffff", 0, 22, beamAngle * 1.25, 0.45, 1.1);
      light.position.copy(mount);
      this.object.add(light, light.target);

      const beamPivot = new THREE.Object3D();
      beamPivot.position.copy(mount);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial("#ffffff"));
      beamPivot.add(beam);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), neonMaterial("#ffffff", 2));
      lens.position.z = 0.02;
      beamPivot.add(lens);
      this.object.add(beamPivot);

      this.heads.push({ mount, light, beam, beamPivot, lens, phase: index * 1.37, colorOffset: index });
    });

    const ballTexture = createCanvasTexture(256, 128, (context, width, height) => {
      const cell = 8;
      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          const shade = 150 + Math.floor(Math.random() * 105);
          context.fillStyle = `rgb(${shade}, ${shade}, ${Math.min(255, shade + 20)})`;
          context.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        }
      }
    });
    this.mirrorBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 28, 18),
      new THREE.MeshStandardMaterial({ map: ballTexture, metalness: 1, roughness: 0.15, emissive: "#3a2a55", emissiveMap: ballTexture }),
    );
    this.mirrorBall.position.set(sweepCenter.x, 4.5, sweepCenter.z);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), housingMaterial);
    chain.position.set(sweepCenter.x, 5.05, sweepCenter.z);
    this.object.add(this.mirrorBall, chain);
  }

  update({ deltaSeconds, music }: SceneFrame): void {
    const energy = music.energy;
    this.sweepTime += deltaSeconds * THREE.MathUtils.lerp(0.25, 1.1, energy);
    const beatPulse = 1 - (music.beats % 1);
    const beatIndex = Math.floor(music.beats / 2);

    for (const head of this.heads) {
      const t = this.sweepTime + head.phase;
      const target = new THREE.Vector3(
        this.sweepCenter.x + Math.sin(t * 1.3) * 4.2 + Math.sin(t * 0.47) * 1.5,
        0,
        this.sweepCenter.z + Math.cos(t * 0.9) * 3.4,
      );
      head.light.target.position.copy(target);
      head.beamPivot.lookAt(target);
      head.beam.scale.setScalar(head.mount.distanceTo(target) / beamLength);

      const paletteIndex = (head.colorOffset + (energy > 0.5 ? beatIndex : Math.floor(this.sweepTime * 0.3))) % beamPalette.length;
      this.workingColor.set(beamPalette[paletteIndex]!);
      head.light.color.copy(this.workingColor);
      head.light.intensity = THREE.MathUtils.lerp(14, 30 + beatPulse * 20, energy);
      head.beam.material.color.copy(this.workingColor);
      head.beam.material.opacity = THREE.MathUtils.lerp(0.04, 0.06 + beatPulse * 0.05, energy);
      head.lens.material.color.copy(this.workingColor).multiplyScalar(1.2 + energy * 1.2);
    }

    this.mirrorBall.rotation.y += deltaSeconds * THREE.MathUtils.lerp(0.2, 1.2, energy);
  }

  dispose(): void {
    this.object.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        (node.material as THREE.Material).dispose();
      }
    });
  }
}
