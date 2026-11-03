import * as THREE from "three";
import { metalMaterial } from "../../engine/shading.ts";
import { aimBeam, dotTexture, lightBeam, place, rnd, type BeamMesh, type ClubMood, type NeonPalette } from "../common/club-kit.ts";
import { ceilingHeight } from "./office-kit.ts";

export interface OfficeLightingFrame {
  elapsedSeconds: number;
  beats: number;
  pulse: number;
  energy: number;
}

interface PartyHead {
  light: THREE.SpotLight;
  lamp: THREE.Group;
  lens: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  beam: BeamMesh;
  index: number;
}

export class OfficeLighting {
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly pantryLight: THREE.PointLight;
  private readonly meetingLight: THREE.PointLight;
  private readonly heads: PartyHead[] = [];
  private readonly haze: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly white = new THREE.Color(1, 1, 1);

  constructor(
    parent: THREE.Object3D,
    private readonly neon: NeonPalette,
    mood: ClubMood,
  ) {
    this.hemisphere = new THREE.HemisphereLight(mood.ambient, mood.ground, 1.15);
    const moonlight = new THREE.DirectionalLight(0x9db8ff, 0.55);
    moonlight.position.set(16, 7, -3);
    const fill = new THREE.DirectionalLight(0xffe6cc, 0.22);
    fill.position.set(-6, 8, 10);
    this.pantryLight = new THREE.PointLight(0xffc888, 7, 9, 1.4);
    this.pantryLight.position.set(-12.8, 2.9, 6.2);
    this.meetingLight = new THREE.PointLight(0xffd6a0, 6, 7, 1.5);
    this.meetingLight.position.set(10.6, 2.9, 6.5);
    parent.add(this.hemisphere, moonlight, fill, this.pantryLight, this.meetingLight);

    const housing = metalMaterial("#1a1a22", { roughness: 0.3 });
    const housingGeometry = new THREE.CylinderGeometry(0.14, 0.17, 0.3, 12);
    const lensGeometry = new THREE.CircleGeometry(0.13, 16);
    const clamp = new THREE.BoxGeometry(0.06, 0.2, 0.06);
    for (const [index, [x, z]] of [
      [-5.2, -7.6],
      [5.2, -7.6],
      [-5.2, 1.6],
      [5.2, 1.6],
    ].entries()) {
      const light = new THREE.SpotLight(0xffffff, 16, 0, 0.32, 0.55, 1.4);
      light.position.set(x!, ceilingHeight - 0.32, z!);
      parent.add(light, light.target);
      place(parent, clamp, housing, [x!, ceilingHeight - 0.1, z!]);
      const lamp = new THREE.Group();
      place(lamp, housingGeometry, housing, [0, 0, 0], [Math.PI / 2, 0, 0]);
      const lens = place(lamp, lensGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }), [0, 0, 0.155]) as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
      lamp.position.copy(light.position);
      parent.add(lamp);
      this.heads.push({ light, lamp, lens, beam: lightBeam(parent, 0.08), index });
    }

    const positions = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i += 1) {
      positions[i * 3] = (rnd() - 0.5) * 14;
      positions[i * 3 + 1] = 0.4 + rnd() * (ceilingHeight - 0.6);
      positions[i * 3 + 2] = -9 + rnd() * 12;
    }
    const hazeGeometry = new THREE.BufferGeometry();
    hazeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.haze = new THREE.Points(
      hazeGeometry,
      new THREE.PointsMaterial({ size: 0.035, map: dotTexture, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    parent.add(this.haze);
  }

  update(frame: OfficeLightingFrame): void {
    const { elapsedSeconds: time, beats, pulse, energy } = frame;
    this.hemisphere.intensity = 1.1 + 0.12 * (1 - energy);
    for (const head of this.heads) {
      const i = head.index;
      const speed = 0.6 + 0.4 * energy;
      head.light.target.position.set(Math.sin(time * 0.5 * speed + i * 1.9) * 4.2, 0, -3.2 + Math.cos(time * 0.41 * speed + i * 2.1) * 3.8);
      head.light.target.updateMatrixWorld();
      const color = this.neon.color(i + Math.floor(beats / 4));
      head.light.color.copy(color);
      head.light.intensity = 10 + 5 * energy + 9 * pulse;
      head.lamp.lookAt(head.light.target.position);
      head.lens.material.color.copy(color).multiplyScalar(3);
      aimBeam(head.beam, head.light.position, head.light.target.position, head.light.angle);
      head.beam.material.uniforms.color!.value.copy(color);
      head.beam.material.uniforms.opacity!.value = 0.05 + 0.02 * energy + 0.05 * pulse;
    }
    this.pantryLight.intensity = 6.5 + 0.6 * Math.sin(time * 0.8);
    this.haze.rotation.y = Math.sin(time * 0.05) * 0.05;
    this.haze.position.y = Math.sin(time * 0.2) * 0.1;
    this.haze.material.color.copy(this.neon.color(1)).lerp(this.white, 0.6);
  }
}
