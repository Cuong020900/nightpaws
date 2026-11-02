import { findSceneDescriptor } from "@nightpaws/shared";
import { neonBarSceneFactory } from "./neon-bar/neon-bar-module.ts";
import type { SceneModule, SceneModuleFactory } from "./scene-module.ts";

const sceneFactories = new Map<string, SceneModuleFactory>();

export function registerSceneFactory(factory: SceneModuleFactory): void {
  sceneFactories.set(factory.sceneId, factory);
}

registerSceneFactory(neonBarSceneFactory);

export function createSceneModule(sceneId: string): SceneModule {
  const descriptor = findSceneDescriptor(sceneId);
  const factory = sceneFactories.get(sceneId);
  if (!descriptor || !factory) throw new Error(`No scene registered for "${sceneId}"`);
  return factory.create(descriptor);
}
