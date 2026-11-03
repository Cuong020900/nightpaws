import * as THREE from "three";
import { environmentMap } from "./shading.ts";

export function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instanced: THREE.InstancedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) instanced.push(object);
    const mesh = object as Partial<THREE.Mesh>;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    if (!material) return;
    for (const entry of Array.isArray(material) ? material : [material]) {
      materials.add(entry);
      for (const value of Object.values(entry)) if (value instanceof THREE.Texture) textures.add(value);
      if (entry instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(entry.uniforms)) if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
      }
    }
  });
  const keep = environmentMap();
  for (const texture of textures) if (texture !== keep) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const mesh of instanced) mesh.dispose();
}
