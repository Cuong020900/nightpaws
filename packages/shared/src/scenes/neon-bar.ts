import type { SceneDescriptor } from "../scene.ts";

export const neonBarScene: SceneDescriptor = {
  id: "neon-bar",
  displayName: "The Neon Paw",
  tagline: "Late-night club for party animals",
  enterLabel: "Enter the club",
  swatches: ["#ff2bd6", "#22e6ff", "#7b2cff"],
  walkableArea: { minX: -15.4, maxX: 15.4, minZ: -13.4, maxZ: 12.6 },
  spawn: { x: 0, z: 7.4, facing: Math.PI },
  bots: {
    count: 10,
    namePool: [
      "Mochi", "Tofu", "Ziggy", "Pixel", "Noodle", "Kiki", "Dumpling",
      "Luna", "Biscuit", "Jazz", "Pepper", "Momo", "Sprout", "Taro", "Neon",
    ],
  },
  hasMusic: true,
};
