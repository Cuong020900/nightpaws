import { characterTypes } from "@nightpaws/shared";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const loaded = new Map<string, GLTF>();

export function characterModelAssets(): string[] {
  const assets = new Set<string>();
  for (const type of characterTypes) if (type.model.kind === "gltf") assets.add(type.model.asset);
  return [...assets];
}

export async function preloadCharacterModels(onProgress: (done: number, total: number) => void): Promise<void> {
  const assets = characterModelAssets().filter((asset) => !loaded.has(asset));
  let done = 0;
  onProgress(done, assets.length);
  await Promise.all(
    assets.map(async (asset) => {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${asset}.glb`);
      loaded.set(asset, gltf);
      done += 1;
      onProgress(done, assets.length);
    }),
  );
}

export function loadedModel(asset: string): GLTF {
  const gltf = loaded.get(asset);
  if (!gltf) throw new Error(`Character model "${asset}" was not preloaded`);
  return gltf;
}
