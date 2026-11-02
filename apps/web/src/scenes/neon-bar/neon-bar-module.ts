import type { FloorRect, RoomMusicState, SceneDescriptor } from "@nightpaws/shared";
import * as THREE from "three";
import { rimColor } from "../../engine/shading.ts";
import type { WorldLook } from "../../engine/world-renderer.ts";
import type { SceneFrame, SceneModule, SceneModuleFactory } from "../scene-module.ts";
import {
  buildBar,
  buildBooth,
  buildChandelier,
  buildDanceFloor,
  buildDecor,
  buildEntrance,
  buildRoom,
  buildStage,
  buildVip,
  type ChandelierParts,
  type DanceFloorParts,
  type RoomParts,
  type StageParts,
  type VipParts,
} from "./club-architecture.ts";
import { ClubCast } from "./club-cast.ts";
import { fract, NeonPalette, neonSynthMood, random, TAU } from "./club-kit.ts";
import { ClubLighting } from "./club-lighting.ts";
import { LedWall } from "./led-wall.ts";

const ledRepaintEveryFrames = 3;
const balconyEdgeZ = 9.9;
const balconyUnderside = 3.95;

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): FloorRect => ({ minX, maxX, minZ, maxZ });

const venueObstacles: FloorRect[] = [
  rect(-9.6, 9.6, -14, -9.3),
  rect(-2.3, 2.3, -9.4, -6.25),
  rect(-3.2, 3.2, -9.4, -7.2),
  rect(-8.4, -6.8, -9.45, -8.35),
  rect(6.8, 8.4, -9.45, -8.35),
  rect(-9.25, -7.15, -7.25, -5.15),
  rect(7.15, 9.25, -7.25, -5.15),
  rect(-16, -12.3, -9.75, 0.75),
  rect(-16, -13.25, 3.0, 6.2),
  rect(-16, -13.25, 6.8, 10.0),
  rect(8.75, 16, -9.15, 5.15),
  rect(2.9, 3.9, 10.9, 11.5),
  rect(-1.9, -1.7, 9.1, 12.6),
  rect(1.7, 1.9, 9.1, 12.6),
  rect(11.35, 16, 10.85, 13),
  ...[-11.5, -5.5, 5.5, 11.5].map((x) => rect(x - 0.22, x + 0.22, 10.08, 10.52)),
];

class NeonBarModule implements SceneModule {
  readonly root = new THREE.Group();
  readonly obstacles: FloorRect[];
  readonly danceArea: FloorRect = rect(-6.2, 6.2, -5.6, 2.6);
  readonly loungeAreas: FloorRect[] = [
    rect(-11.4, -10.6, -9, 0),
    rect(-12.6, -11.6, 3.4, 9.6),
    rect(-9, 9, 5, 9),
    rect(6.9, 8.2, -4, 0),
    rect(-8, 8, -8.2, -6.6),
  ];
  readonly showcaseSpot = new THREE.Vector3(0, 0, 4.7);
  readonly showcaseStage: FloorRect = rect(-2.6, 2.6, 3.2, 6.6);
  readonly look: WorldLook;
  private readonly neon = new NeonPalette(neonSynthMood);
  private readonly room: RoomParts;
  private readonly stage: StageParts;
  private readonly floor: DanceFloorParts;
  private readonly chandelier: ChandelierParts;
  private readonly vip: VipParts;
  private readonly lighting: ClubLighting;
  private readonly ledWall: LedWall;
  private readonly cast: ClubCast;
  private readonly tileColor = new THREE.Color();
  private readonly cableAnchor = new THREE.Vector3();
  private readonly cameraRay = new THREE.Vector3();
  private frames = 0;

  constructor(readonly descriptor: SceneDescriptor) {
    this.root.name = `scene:${descriptor.id}`;
    random.seed = 11;
    const mood = neonSynthMood;
    this.look = {
      fogColor: new THREE.Color(mood.fog),
      fogDensity: mood.fogDensity,
      bloomStrength: mood.bloom,
      gradeTint: new THREE.Color(...mood.grade),
    };
    this.room = buildRoom(this.root, this.neon);
    this.room.wallMaterial.color.set(mood.wall);
    this.stage = buildStage(this.root, this.neon, this.room.steel);
    this.floor = buildDanceFloor(this.root, this.neon);
    this.chandelier = buildChandelier(this.root, this.neon);
    buildBar(this.root, this.neon);
    buildBooth(this.root, -14.2, 0, 4.6, Math.PI / 2, "#5a1424");
    buildBooth(this.root, -14.2, 0, 8.4, Math.PI / 2, "#5a1424");
    this.vip = buildVip(this.root, this.neon);
    buildEntrance(this.root, this.neon, this.room.steel);
    buildDecor(this.root);
    this.lighting = new ClubLighting(this.root, this.room.steel, this.neon, mood);
    this.ledWall = new LedWall(this.stage, this.neon);
    this.cast = new ClubCast(this.root);
    this.obstacles = [...venueObstacles, ...this.cast.obstacles];
  }

  update(frame: SceneFrame): void {
    const { elapsedSeconds: time, deltaSeconds: dt, music } = frame;
    const beats = music.beats;
    const energy = music.energy;
    const pulse = Math.pow(1 - fract(beats), 3) * (0.4 + 0.6 * energy);
    const phase = beats * TAU;
    this.frames += 1;

    this.neon.update(time, pulse);
    rimColor.value.copy(this.neon.color(1)).multiplyScalar(0.3).add(this.tileColor.copy(this.neon.color(0)).multiplyScalar(0.18));
    this.updateDanceFloor(beats, phase, pulse, energy);
    this.lighting.update({ elapsedSeconds: time, beats, pulse, energy });
    this.updateChandelier(time);
    for (const deck of this.stage.decks) deck.rotation.y += dt * 3.5 * (0.3 + 0.7 * energy);
    this.stage.mixerLeds.forEach((led, i) => (led.visible = fract(beats * 2 + i * 0.17) < 0.6));
    for (const ring of this.stage.speakerRings) {
      const scale = 1 + pulse * 0.08;
      ring.scale.set(scale, scale, 1);
    }
    this.vip.sparkSeeds.forEach(([angle, start, speed], i) => {
      const life = fract(time * speed + start);
      this.vip.sparkPositions[i * 3] = Math.cos(angle) * life * 0.25;
      this.vip.sparkPositions[i * 3 + 1] = life * 0.5 - life * life * 0.6;
      this.vip.sparkPositions[i * 3 + 2] = Math.sin(angle) * life * 0.25;
    });
    this.vip.sparkler.geometry.attributes.position!.needsUpdate = true;
    if (this.frames % ledRepaintEveryFrames === 0) this.ledWall.draw(time, beats, energy);
    this.cast.update(frame);
  }

  constrainCamera(focus: THREE.Vector3, camera: THREE.Vector3): void {
    const direction = this.cameraRay.subVectors(camera, focus);
    let reach = 1;
    const limit = (value: number, origin: number, delta: number, min: number, max: number) => {
      if (value > max && delta > 0) reach = Math.min(reach, (max - origin) / delta);
      if (value < min && delta < 0) reach = Math.min(reach, (min - origin) / delta);
    };
    limit(camera.x, focus.x, direction.x, -15.5, 15.5);
    limit(camera.y, focus.y, direction.y, 0.3, 8.4);
    limit(camera.z, focus.z, direction.z, -13.6, 12.6);
    if (camera.z > balconyEdgeZ && focus.y < balconyUnderside && direction.y > 0) {
      reach = Math.min(reach, (balconyUnderside - focus.y) / direction.y);
    }
    camera.copy(focus).addScaledVector(direction, Math.max(0.2, reach));
  }

  showMusicState(state: RoomMusicState | null): void {
    this.ledWall.showMusicState(state);
  }

  dispose(): void {
    this.cast.dispose();
    this.neon.dispose();
    this.root.removeFromParent();
  }

  private updateDanceFloor(beats: number, phase: number, pulse: number, energy: number): void {
    const pattern = Math.floor(beats / 8) % 3;
    const glow = 1.05 * (0.6 + 0.4 * energy);
    this.floor.layout.forEach((tile, n) => {
      let colorIndex: number;
      let value: number;
      if (pattern === 0) {
        colorIndex = (tile.i + tile.j + Math.floor(beats)) & 1 ? 0 : 1;
        value = 0.25 + 0.75 * pulse;
      } else if (pattern === 1) {
        const wave = 0.5 + 0.5 * Math.sin(tile.distance * 1.4 - phase * 0.5);
        colorIndex = Math.floor(tile.distance + beats) % 4;
        value = 0.1 + 0.9 * Math.pow(wave, 3);
      } else {
        const wave = 0.5 + 0.5 * Math.sin((tile.i - tile.j) * 0.8 + phase * 0.25);
        colorIndex = ((Math.floor((tile.i + tile.j) / 3 + beats / 2) % 4) + 4) % 4;
        value = 0.08 + 0.92 * Math.pow(wave, 4);
      }
      this.tileColor.copy(this.neon.color(colorIndex)).multiplyScalar(value * glow);
      this.floor.tiles.setColorAt(n, this.tileColor);
    });
    this.floor.tiles.instanceColor!.needsUpdate = true;
  }

  private updateChandelier(time: number): void {
    const { group, rings, cables, cablePositions } = this.chandelier;
    for (const { ring, index } of rings) {
      ring.position.y = 0.4 * Math.sin(time * 0.7 + index * 0.6);
      ring.rotation.x = 0.18 * Math.sin(time * 0.5 + index * 0.45);
      ring.rotation.z = 0.22 * Math.cos(time * 0.43 + index * 0.5);
    }
    group.updateMatrixWorld(true);
    let cursor = 0;
    for (const { ring, radius } of rings) {
      for (let k = 0; k < 3; k += 1) {
        const angle = (k * TAU) / 3 + 0.3;
        this.cableAnchor.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        ring.localToWorld(this.cableAnchor);
        cablePositions.set([this.cableAnchor.x, 9, this.cableAnchor.z, this.cableAnchor.x, this.cableAnchor.y, this.cableAnchor.z], cursor);
        cursor += 6;
      }
    }
    cables.geometry.attributes.position!.needsUpdate = true;
  }
}

export const neonBarSceneFactory: SceneModuleFactory = {
  sceneId: "neon-bar",
  create: (descriptor) => new NeonBarModule(descriptor),
};
