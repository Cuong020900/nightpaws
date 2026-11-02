import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

let environment: THREE.Texture | null = null;

export function initEnvironment(renderer: THREE.WebGLRenderer): void {
  if (environment) return;
  const pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

export function environmentMap(): THREE.Texture | null {
  return environment;
}

export const rimColor = { value: new THREE.Color(0.3, 0.2, 0.4) };

export function rimify<T extends THREE.Material>(material: T, strength = 1): T {
  const amount = strength.toFixed(2);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = rimColor;
    shader.fragmentShader =
      "uniform vec3 uRim;\n" +
      shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `outgoingLight += uRim * ${amount} * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.2);\n#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `rim${amount}`;
  return material;
}

export function lighter(color: THREE.ColorRepresentation, amount = 0.35): THREE.Color {
  return new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), amount);
}

export function venueMaterial(parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(parameters);
}

export function clothMaterial(color: THREE.ColorRepresentation, parameters: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, envMap: environment, envMapIntensity: 0.3, ...parameters });
}

export function metalMaterial(color: THREE.ColorRepresentation, parameters: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22, envMap: environment, envMapIntensity: 1.3, ...parameters });
}
