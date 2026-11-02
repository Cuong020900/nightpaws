import type { SceneDescriptor } from "../scene.ts";

export const neonBarScene: SceneDescriptor = {
  id: "neon-bar",
  displayName: "The Neon Paw",
  tagline: "Late-night club for party animals",
  walkableArea: { minX: -11.2, maxX: 11.2, minZ: -8.2, maxZ: 8.2 },
  spawn: { x: 0, z: 6.5, facing: Math.PI },
  bots: {
    count: 10,
    namePool: [
      "Mochi", "Bao", "Tofu", "Ziggy", "Pixel", "Noodle", "Kiki", "Dumpling",
      "Luna", "Biscuit", "Jazz", "Pepper", "Momo", "Sprout", "Taro", "Neon",
    ],
  },
  hasMusic: true,
};
