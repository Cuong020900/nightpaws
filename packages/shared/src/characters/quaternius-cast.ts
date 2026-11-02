import type { CharacterTypeDescriptor, ModelCredit } from "../character.ts";
import { allDanceMoveIds } from "../dances.ts";

const credit = (title: string, url: string): ModelCredit => ({ title, author: "Quaternius", license: "CC0 1.0", url });

interface CastEntry {
  id: string;
  displayName: string;
  tagline: string;
  height: number;
  walkSpeed: number;
  selectable: boolean;
  swatches: string[];
  asset: string;
  hiddenMeshes?: string[];
  credit: ModelCredit;
}

function castCharacter(entry: CastEntry): CharacterTypeDescriptor {
  return {
    id: entry.id,
    displayName: entry.displayName,
    tagline: entry.tagline,
    height: entry.height,
    walkSpeed: entry.walkSpeed,
    selectable: entry.selectable,
    swatches: entry.swatches,
    model: { kind: "gltf", asset: entry.asset, hiddenMeshes: entry.hiddenMeshes ?? [], credit: entry.credit },
    dances: allDanceMoveIds,
  };
}

export const rabbitCharacter = castCharacter({
  id: "rabbit",
  displayName: "Rabbit",
  tagline: "The hype, never stops moving",
  height: 1.55,
  walkSpeed: 3.6,
  selectable: true,
  swatches: ["#f2ece6", "#f6a6c8", "#2a2030"],
  asset: "rabbit",
  credit: credit("Rabbit", "https://poly.pizza/m/mKev485XTR"),
});

export const greyRabbitCharacter = castCharacter({
  id: "rabbit-grey",
  displayName: "Grey Rabbit",
  tagline: "Smooth host, two-steps the drop",
  height: 1.6,
  walkSpeed: 3.4,
  selectable: true,
  swatches: ["#9a9aa6", "#e8e2ea", "#3a3446"],
  asset: "rabbit-grey",
  credit: credit("Rabbit Grey", "https://poly.pizza/m/KRnXIKJbqp"),
});

export const blondRabbitCharacter = castCharacter({
  id: "rabbit-blond",
  displayName: "Blond Rabbit",
  tagline: "Podium star with golden hair",
  height: 1.6,
  walkSpeed: 3.5,
  selectable: true,
  swatches: ["#f4d27a", "#f2ece6", "#c46a8a"],
  asset: "rabbit-blond",
  credit: credit("Rabbit Blond", "https://poly.pizza/m/cMsI6FDhNx"),
});

export const pigtailRabbitCharacter = castCharacter({
  id: "rabbit-pigtails",
  displayName: "Pigtail Rabbit",
  tagline: "Stage go-go, full routine",
  height: 1.6,
  walkSpeed: 3.5,
  selectable: true,
  swatches: ["#8a4a2a", "#f2ece6", "#ff7ab0"],
  asset: "rabbit-pigtails",
  credit: credit("Rabbit With pigtails", "https://poly.pizza/m/SwKX8OIlw8"),
});

export const cyanRabbitCharacter = castCharacter({
  id: "rabbit-cyan",
  displayName: "Cyan Rabbit",
  tagline: "Neon hair, mirror moves",
  height: 1.6,
  walkSpeed: 3.5,
  selectable: true,
  swatches: ["#3ad6e6", "#f2ece6", "#5a3a8a"],
  asset: "rabbit-cyan",
  credit: credit("Rabbit Cyan Hair", "https://poly.pizza/m/RPZ9gxcFL3"),
});

export const bunnyCharacter = castCharacter({
  id: "bunny",
  displayName: "Bunny",
  tagline: "Small paws, big hops",
  height: 1.55,
  walkSpeed: 3.6,
  selectable: true,
  swatches: ["#f6f0ea", "#f6a6c8", "#ff8a3d"],
  asset: "bunny",
  hiddenMeshes: ["Carrot"],
  credit: credit("Bunny", "https://poly.pizza/m/irZjWFARyl"),
});

export const sharkCharacter = castCharacter({
  id: "shark",
  displayName: "Shark",
  tagline: "Resident DJ energy",
  height: 1.75,
  walkSpeed: 3.3,
  selectable: true,
  swatches: ["#5a7a9a", "#e8eef4", "#2a3440"],
  asset: "sharky",
  hiddenMeshes: ["Weapon_Sword_2", "Cube.001"],
  credit: credit("Sharky", "https://poly.pizza/m/iPV5YmAoIv"),
});

export const pandaPatronCharacter = castCharacter({
  id: "panda-patron",
  displayName: "Panda Patron",
  tagline: "Background regular",
  height: 1.5,
  walkSpeed: 3.0,
  selectable: false,
  swatches: ["#f4f1ea", "#2a2a33", "#c0262c"],
  asset: "panda",
  credit: credit("Panda", "https://poly.pizza/m/q1uJ28Hs8T"),
});
