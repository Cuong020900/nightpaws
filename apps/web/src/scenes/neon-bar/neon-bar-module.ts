import type { FloorRect, RoomMusicState, SceneDescriptor } from "@nightpaws/shared";
import * as THREE from "three";
import type { SceneFrame, SceneModule, SceneModuleFactory } from "../scene-module.ts";
import { createBarCounter, createEntranceDecor, createLounge } from "./bar-furniture.ts";
import { ClubLights } from "./club-lights.ts";
import { DanceFloor } from "./dance-floor.ts";
import { DjBooth } from "./dj-booth.ts";
import { createRoomShell, roomSize } from "./room-shell.ts";

class NeonBarModule implements SceneModule {
  readonly root = new THREE.Group();
  readonly obstacles: FloorRect[];
  readonly danceArea: FloorRect;
  readonly loungeAreas: FloorRect[];
  readonly showcaseSpot = new THREE.Vector3(0, 0, 6.6);
  readonly showcaseStage: FloorRect = { minX: -2.6, maxX: 2.6, minZ: 5, maxZ: 9 };
  private readonly danceFloor: DanceFloor;
  private readonly lights: ClubLights;
  private readonly djBooth: DjBooth;
  private readonly ambientLight: THREE.HemisphereLight;

  constructor(readonly descriptor: SceneDescriptor) {
    this.root.name = `scene:${descriptor.id}`;
    const halfWidth = roomSize.width / 2;
    const halfDepth = roomSize.depth / 2;

    this.root.add(createRoomShell());

    this.danceFloor = new DanceFloor(new THREE.Vector2(0, -1.2), 7);
    this.danceArea = this.danceFloor.area;
    this.root.add(this.danceFloor.object);

    this.djBooth = new DjBooth(-halfDepth);
    this.root.add(this.djBooth.object);

    const bar = createBarCounter(-halfWidth);
    const lounge = createLounge(halfWidth);
    this.root.add(bar.object, lounge.object, createEntranceDecor(halfDepth));

    const mountPoints = [-4.5, 0, 4.5].flatMap((x) => [new THREE.Vector3(x, 5.15, -5), new THREE.Vector3(x, 5.15, 1)]);
    this.lights = new ClubLights(mountPoints, new THREE.Vector3(0, 0, -1.2));
    this.root.add(this.lights.object);

    this.ambientLight = new THREE.HemisphereLight("#8f7bff", "#2a0f3a", 1.6);
    const keyLight = new THREE.DirectionalLight("#ffd9f4", 0.9);
    keyLight.position.set(3, 8, 6);
    const fillLight = new THREE.PointLight("#9b5cff", 14, 14, 1.2);
    fillLight.position.set(0, 4, 5);
    this.root.add(this.ambientLight, keyLight, fillLight);

    this.obstacles = [this.djBooth.obstacle, ...bar.obstacles, ...lounge.obstacles];
    this.loungeAreas = [
      { minX: -8.3, maxX: -7.2, minZ: -4.5, maxZ: 3.5 },
      { minX: 7.2, maxX: 9.2, minZ: -5.5, maxZ: 3.5 },
      { minX: -6, maxX: 6, minZ: 3, maxZ: 4.6 },
    ];
  }

  update(frame: SceneFrame): void {
    this.danceFloor.update(frame);
    this.lights.update(frame);
    this.djBooth.update(frame);
    this.ambientLight.intensity = THREE.MathUtils.lerp(1.6, 1.1, frame.music.energy);
  }

  showMusicState(state: RoomMusicState | null): void {
    this.djBooth.showMusicState(state);
  }

  dispose(): void {
    this.danceFloor.dispose();
    this.lights.dispose();
    this.djBooth.dispose();
    this.root.removeFromParent();
  }
}

export const neonBarSceneFactory: SceneModuleFactory = {
  sceneId: "neon-bar",
  create: (descriptor) => new NeonBarModule(descriptor),
};
