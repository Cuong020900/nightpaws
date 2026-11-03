import type { FloorRect, RoomMusicState, SceneDescriptor } from "@nightpaws/shared";
import * as THREE from "three";
import type { CrowdCue } from "../../actors/crowd-cue.ts";
import { rimColor } from "../../engine/shading.ts";
import type { WorldLook } from "../../engine/world-renderer.ts";
import { fract, NeonPalette, random, TAU } from "../common/club-kit.ts";
import { SceneCast } from "../common/scene-cast.ts";
import { VjScreen } from "../common/vj-screen.ts";
import type { SceneFrame, SceneModule, SceneModuleFactory } from "../scene-module.ts";
import { buildOffice, officeObstacles, type OfficeParts } from "./office-architecture.ts";
import { officeCastMembers } from "./office-cast.ts";
import { ceilingHeight, composePlacement, officePartyMood } from "./office-kit.ts";
import { OfficeLighting } from "./office-lighting.ts";

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): FloorRect => ({ minX, maxX, minZ, maxZ });

const afterHoursPanel = new THREE.Color(0.55, 0.5, 0.42);
const quietScreen = new THREE.Color(0.16, 0.22, 0.4);

class OfficeModule implements SceneModule {
  readonly root = new THREE.Group();
  readonly obstacles: FloorRect[];
  readonly danceArea: FloorRect = rect(-5.2, 5.2, -8.4, 2.2);
  readonly loungeAreas: FloorRect[] = [
    rect(-13.4, -9.2, 3.4, 8.8),
    rect(7.6, 13.8, 4.2, 9.2),
    rect(8.4, 12.8, -6.2, -4.8),
    rect(-12.8, -8.4, -6.2, -4.8),
    rect(-8.4, -3.2, 8.2, 9.3),
    rect(1.2, 4.2, 9.0, 10.8),
  ];
  readonly showcaseSpot = new THREE.Vector3(0, 0, 4.6);
  readonly showcaseStage: FloorRect = rect(-2.4, 2.4, 3.1, 6.4);
  readonly look: WorldLook;
  private readonly neon = new NeonPalette(officePartyMood);
  private readonly parts: OfficeParts;
  private readonly lighting: OfficeLighting;
  private readonly vjScreen: VjScreen;
  private readonly cast: SceneCast;
  private readonly scratch = new THREE.Color();
  private readonly matrix = new THREE.Matrix4();
  private readonly cameraRay = new THREE.Vector3();

  constructor(readonly descriptor: SceneDescriptor) {
    this.root.name = `scene:${descriptor.id}`;
    random.seed = 23;
    const mood = officePartyMood;
    this.look = {
      fogColor: new THREE.Color(mood.fog),
      fogDensity: mood.fogDensity,
      bloomStrength: mood.bloom,
      gradeTint: new THREE.Color(...mood.grade),
    };
    this.parts = buildOffice(this.root, this.neon, mood.wall);
    this.lighting = new OfficeLighting(this.root, this.neon, mood);
    this.vjScreen = new VjScreen(this.parts.screen, this.neon, "DJ KIP · TAP ♪ REQUEST TO QUEUE A TRACK");
    this.cast = new SceneCast(this.root, officeCastMembers);
    this.obstacles = [...officeObstacles, ...this.cast.obstacles];
  }

  update(frame: SceneFrame): void {
    const { elapsedSeconds: time, deltaSeconds: dt, music } = frame;
    const beats = music.beats;
    const energy = music.energy;
    const pulse = Math.pow(1 - fract(beats), 3) * (0.4 + 0.6 * energy);

    this.neon.update(time, pulse);
    rimColor.value.copy(this.neon.color(1)).multiplyScalar(0.22).add(this.scratch.copy(this.neon.color(0)).multiplyScalar(0.16));
    this.lighting.update({ elapsedSeconds: time, beats, pulse, energy });
    this.updateCeilingPanels(beats, pulse, energy);
    this.updateStringLights(time, beats, energy);
    this.updateMonitors(time, beats, energy);
    this.updateBalloons(time);
    this.parts.discoBall.rotation.y += dt * (0.4 + 0.5 * energy);
    for (const wheel of this.parts.jogWheels) wheel.rotation.y += dt * 4 * (0.3 + 0.7 * energy);
    this.parts.mixerLeds.forEach((led, i) => (led.visible = fract(beats * 2 + i * 0.19) < 0.6));
    for (const woofer of this.parts.woofers) {
      const scale = 1 + pulse * 0.1;
      woofer.scale.set(scale, 1, scale);
    }
    this.vjScreen.update(time, dt, beats, energy, pulse);
    this.cast.update(frame);
  }

  constrainCamera(focus: THREE.Vector3, camera: THREE.Vector3): void {
    const direction = this.cameraRay.subVectors(camera, focus);
    let reach = 1;
    const limit = (value: number, origin: number, delta: number, min: number, max: number) => {
      if (value > max && delta > 0) reach = Math.min(reach, (max - origin) / delta);
      if (value < min && delta < 0) reach = Math.min(reach, (min - origin) / delta);
    };
    limit(camera.x, focus.x, direction.x, -14.7, 14.7);
    limit(camera.y, focus.y, direction.y, 0.3, ceilingHeight - 0.3);
    limit(camera.z, focus.z, direction.z, -11.7, 11.7);
    camera.copy(focus).addScaledVector(direction, Math.max(0.2, reach));
  }

  setCrowdCue(cue: CrowdCue): void {
    this.cast.setCue(cue);
  }

  showMusicState(state: RoomMusicState | null): void {
    this.vjScreen.showMusicState(state);
  }

  dispose(): void {
    this.cast.dispose();
    this.vjScreen.dispose();
    this.neon.dispose();
    this.root.removeFromParent();
  }

  private updateCeilingPanels(beats: number, pulse: number, energy: number): void {
    const { panels, partyPanels, panelCenters } = this.parts;
    const chase = Math.floor(beats) % 4;
    partyPanels.forEach((party, i) => {
      if (!party) {
        panels.setColorAt(i, afterHoursPanel);
        return;
      }
      const center = panelCenters[i]!;
      const ring = Math.round(Math.hypot(center.x, center.y + 2.6) / 3.4);
      const lit = energy > 0.05 ? (ring + chase) % 2 === 0 : true;
      this.scratch.copy(this.neon.color(ring + Math.floor(beats / 4))).multiplyScalar(lit ? 0.6 + 1.6 * pulse + 0.3 * energy : 0.18);
      panels.setColorAt(i, this.scratch);
    });
    panels.instanceColor!.needsUpdate = true;
  }

  private updateStringLights(time: number, beats: number, energy: number): void {
    const { bulbs, bulbStrand } = this.parts;
    const speed = energy > 0.05 ? beats * 2 : time * 1.5;
    bulbStrand.forEach((strand, i) => {
      const wave = 0.5 + 0.5 * Math.sin(i * 0.9 - speed * Math.PI * 0.5 + strand);
      this.scratch.copy(this.neon.color(i + strand)).multiplyScalar(0.7 + 1.8 * wave);
      bulbs.setColorAt(i, this.scratch);
    });
    bulbs.instanceColor!.needsUpdate = true;
  }

  private updateMonitors(time: number, beats: number, energy: number): void {
    const { monitors } = this.parts;
    for (let i = 0; i < monitors.count; i += 1) {
      const glow = 0.5 + 0.5 * Math.sin(time * 0.6 + i * 1.7);
      if (energy > 0.05) this.scratch.copy(this.neon.color(i + Math.floor(beats / 2))).multiplyScalar(0.45 + 0.5 * glow);
      else this.scratch.copy(quietScreen).lerp(this.neon.color(i), 0.35 * glow);
      monitors.setColorAt(i, this.scratch);
    }
    monitors.instanceColor!.needsUpdate = true;
  }

  private updateBalloons(time: number): void {
    const { balloons, balloonRest } = this.parts;
    balloonRest.forEach((rest, i) => {
      const bob = Math.sin(time * 1.1 + i * 0.7) * 0.04;
      const sway = Math.sin(time * 0.7 + i * 1.3) * 0.08;
      composePlacement({ ...rest, at: [rest.at[0], rest.at[1] + bob, rest.at[2]], turn: (i * TAU) / 7, tilt: sway }, this.matrix);
      balloons.setMatrixAt(i, this.matrix);
    });
    balloons.instanceMatrix.needsUpdate = true;
  }
}

export const officeSceneFactory: SceneModuleFactory = {
  sceneId: "office",
  create: (descriptor) => new OfficeModule(descriptor),
};
