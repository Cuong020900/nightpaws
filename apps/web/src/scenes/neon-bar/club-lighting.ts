import * as THREE from "three";
import { metalMaterial } from "../../engine/shading.ts";
import { aimBeam, dotTexture, lightBeam, place, rnd, V3, type BeamMesh, type ClubMood, type NeonPalette } from "../common/club-kit.ts";

interface MovingHead {
  light: THREE.SpotLight;
  lamp: THREE.Group;
  lens: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  beam: BeamMesh;
  index: number;
}

interface Wash {
  from: THREE.Vector3;
  to: THREE.Vector3;
  beam: BeamMesh;
}

export interface LightingFrame {
  elapsedSeconds: number;
  beats: number;
  pulse: number;
  energy: number;
}

export class ClubLighting {
  readonly hemisphere: THREE.HemisphereLight;
  private readonly stageLight: THREE.PointLight;
  private readonly barLight: THREE.PointLight;
  private readonly heads: MovingHead[] = [];
  private readonly washes: Wash[] = [];
  private readonly haze: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly scratch = new THREE.Color();
  private readonly white = new THREE.Color(1, 1, 1);

  constructor(
    parent: THREE.Object3D,
    steel: THREE.Material,
    private readonly neon: NeonPalette,
    mood: ClubMood,
  ) {
    this.hemisphere = new THREE.HemisphereLight(mood.ambient, mood.ground, 0.8);
    const key = new THREE.DirectionalLight(0xfff0f6, 0.5);
    key.position.set(4, 9, 11);
    this.stageLight = new THREE.PointLight(0xffffff, 12, 18, 1.3);
    this.stageLight.position.set(0, 4.6, -11.0);
    this.barLight = new THREE.PointLight(0xffffff, 9, 12, 1.5);
    this.barLight.position.set(-14.6, 2.6, -4.5);
    parent.add(this.hemisphere, key, this.stageLight, this.barLight);

    for (const [w, d, x, z] of [
      [14.6, 0.2, 0, -7.2],
      [14.6, 0.2, 0, 4.2],
      [0.2, 11.4, -7.3, -1.5],
      [0.2, 11.4, 7.3, -1.5],
    ] as const)
      place(parent, new THREE.BoxGeometry(w, 0.2, d), steel, [x, 8.4, z]);
    const housing = metalMaterial("#1a1a22", { roughness: 0.3 });
    const housingGeometry = new THREE.CylinderGeometry(0.2, 0.24, 0.42, 12);
    const lensGeometry = new THREE.CircleGeometry(0.19, 16);
    for (const [index, [x, z]] of [
      [-6.6, -7.2],
      [6.6, -7.2],
      [-6.6, 4.2],
      [6.6, 4.2],
    ].entries()) {
      const light = new THREE.SpotLight(0xffffff, 34, 0, 0.27, 0.55, 1.5);
      light.position.set(x!, 8.0, z!);
      parent.add(light, light.target);
      const lamp = new THREE.Group();
      place(lamp, housingGeometry, housing, [0, 0, 0], [Math.PI / 2, 0, 0]);
      const lens = place(lamp, lensGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }), [0, 0, 0.215]) as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
      lamp.position.copy(light.position);
      parent.add(lamp);
      this.heads.push({ light, lamp, lens, beam: lightBeam(parent, 0.12), index });
    }
    for (const sx of [-1, 1]) this.washes.push({ from: V3(sx * 3.2, 8.3, -8.2), to: V3(sx * 5.8, 2.2, -11.6), beam: lightBeam(parent, 0.08) });

    const positions = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i += 1) {
      positions[i * 3] = (rnd() - 0.5) * 30;
      positions[i * 3 + 1] = rnd() * 8.5;
      positions[i * 3 + 2] = -13 + rnd() * 25;
    }
    const hazeGeometry = new THREE.BufferGeometry();
    hazeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.haze = new THREE.Points(
      hazeGeometry,
      new THREE.PointsMaterial({ size: 0.04, map: dotTexture, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    parent.add(this.haze);
  }

  update(frame: LightingFrame): void {
    const { elapsedSeconds: time, beats, pulse, energy } = frame;
    const colors = this.neon;
    this.hemisphere.intensity = 0.75 + 0.1 * (1 - energy);
    for (const head of this.heads) {
      const i = head.index;
      const speed = 0.7 + 0.3 * energy;
      head.light.target.position.set(Math.sin(time * 0.45 * speed + i * 1.7) * 5.2, 0, -1.5 + Math.cos(time * 0.37 * speed + i * 2.3) * 4);
      head.light.target.updateMatrixWorld();
      const color = colors.color(i + Math.floor(beats / 4));
      head.light.color.copy(color);
      head.light.intensity = 22 + 6 * energy + 14 * pulse;
      head.lamp.lookAt(head.light.target.position);
      head.lens.material.color.copy(color).multiplyScalar(3);
      aimBeam(head.beam, head.light.position, head.light.target.position, head.light.angle);
      head.beam.material.uniforms.color!.value.copy(color);
      head.beam.material.uniforms.opacity!.value = 0.06 + 0.02 * energy + 0.05 * pulse;
    }
    this.washes.forEach((wash, i) => {
      aimBeam(wash.beam, wash.from, wash.to, 0.2);
      wash.beam.material.uniforms.color!.value.copy(colors.color(i * 2 + Math.floor(beats / 8)));
      wash.beam.material.uniforms.opacity!.value = 0.06;
    });
    this.scratch.copy(colors.color(0)).lerp(colors.color(1), 0.5 + 0.5 * Math.sin(time * 0.7));
    this.stageLight.color.copy(this.scratch);
    this.stageLight.intensity = 10 + 8 * pulse;
    this.barLight.color.copy(colors.color(1));
    this.haze.rotation.y = Math.sin(time * 0.05) * 0.05;
    this.haze.position.y = Math.sin(time * 0.2) * 0.15;
    this.haze.material.color.copy(colors.color(2)).lerp(this.white, 0.5);
  }
}
