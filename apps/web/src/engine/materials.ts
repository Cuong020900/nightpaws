import * as THREE from "three";

let toonGradient: THREE.DataTexture | null = null;

function getToonGradient(): THREE.DataTexture {
  if (toonGradient) return toonGradient;
  const steps = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
  toonGradient = new THREE.DataTexture(steps, 4, 1, THREE.RGBAFormat);
  toonGradient.minFilter = THREE.NearestFilter;
  toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.needsUpdate = true;
  return toonGradient;
}

const toonMaterialCache = new Map<string, THREE.MeshToonMaterial>();

export function toonMaterial(color: string): THREE.MeshToonMaterial {
  const cached = toonMaterialCache.get(color);
  if (cached) return cached;
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient() });
  toonMaterialCache.set(color, material);
  return material;
}

export const outlineMaterial = new THREE.MeshBasicMaterial({ color: "#07040d", side: THREE.BackSide });

export const eyeHighlightMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff" });

export function neonMaterial(color: THREE.ColorRepresentation, intensity = 2.4): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  material.color.multiplyScalar(intensity);
  return material;
}

export function beamMaterial(color: THREE.ColorRepresentation): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
