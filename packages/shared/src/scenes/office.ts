import type { SceneDescriptor } from "../scene.ts";

export const officeScene: SceneDescriptor = {
  id: "office",
  displayName: "Pawsworks HQ",
  tagline: "After-hours office party on the 12th floor",
  enterLabel: "Clock in to the party",
  swatches: ["#ffb84a", "#3ad4ff", "#ff4fa3"],
  walkableArea: { minX: -14.5, maxX: 14.5, minZ: -11.5, maxZ: 11.4 },
  spawn: { x: 0, z: 6.8, facing: Math.PI },
  bots: {
    count: 8,
    namePool: [
      "Kip", "Marlo", "Bea", "Otis", "Wren", "Pip", "Juniper", "Dex",
      "Hazel", "Rory", "Sunny", "Ivo", "Clem", "Nova", "Basil",
    ],
  },
  hasMusic: true,
};
