import type { FloorRect, RoomMusicState, SceneDescriptor } from "@nightpaws/shared";
import type * as THREE from "three";
import type { CharacterActor } from "../actors/character-actor.ts";
import type { CrowdCue } from "../actors/crowd-cue.ts";
import type { ViewSample } from "../engine/view-sample.ts";
import type { WorldLook } from "../engine/world-renderer.ts";

export interface MusicPulse {
  isPlaying: boolean;
  energy: number;
  beats: number;
}

export interface SceneFrame {
  deltaSeconds: number;
  elapsedSeconds: number;
  music: MusicPulse;
  view: ViewSample;
}

export interface SceneModule {
  readonly descriptor: SceneDescriptor;
  readonly root: THREE.Object3D;
  readonly look: WorldLook;
  readonly obstacles: FloorRect[];
  readonly danceArea: FloorRect;
  readonly loungeAreas: FloorRect[];
  readonly showcaseSpot: THREE.Vector3;
  readonly showcaseStage: FloorRect;
  readonly residents?: readonly CharacterActor[];
  constrainCamera(focus: THREE.Vector3, camera: THREE.Vector3): void;
  update(frame: SceneFrame): void;
  showMusicState(state: RoomMusicState | null): void;
  setCrowdCue(cue: CrowdCue): void;
  dispose(): void;
}

export interface SceneModuleFactory {
  readonly sceneId: string;
  create(descriptor: SceneDescriptor): SceneModule;
}
