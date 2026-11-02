import type { FloorRect, RoomMusicState, SceneDescriptor } from "@nightpaws/shared";
import type * as THREE from "three";

export interface MusicPulse {
  isPlaying: boolean;
  energy: number;
  beats: number;
}

export interface SceneFrame {
  deltaSeconds: number;
  elapsedSeconds: number;
  music: MusicPulse;
}

export interface SceneModule {
  readonly descriptor: SceneDescriptor;
  readonly root: THREE.Object3D;
  readonly obstacles: FloorRect[];
  readonly danceArea: FloorRect;
  readonly loungeAreas: FloorRect[];
  readonly showcaseSpot: THREE.Vector3;
  readonly showcaseStage: FloorRect;
  update(frame: SceneFrame): void;
  showMusicState(state: RoomMusicState | null): void;
  dispose(): void;
}

export interface SceneModuleFactory {
  readonly sceneId: string;
  create(descriptor: SceneDescriptor): SceneModule;
}
