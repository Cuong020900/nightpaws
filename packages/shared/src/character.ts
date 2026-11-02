export type Vector3Tuple = [number, number, number];

export type DanceMoveId =
  | "bounce"
  | "twostep"
  | "shuffle"
  | "robot"
  | "point"
  | "handsup"
  | "roll"
  | "hype"
  | "wristroll"
  | "woah"
  | "runningman"
  | "dougie"
  | "floss"
  | "shoot"
  | "millyrock";

export interface DanceMoveDescriptor {
  id: DanceMoveId;
  displayName: string;
}

export interface ModelCredit {
  title: string;
  author: string;
  license: string;
  url: string;
}

export type CharacterModelSource =
  | { kind: "hero-panda" }
  | { kind: "gltf"; asset: string; hiddenMeshes: string[]; credit: ModelCredit };

export interface CharacterTypeDescriptor {
  id: string;
  displayName: string;
  tagline: string;
  height: number;
  walkSpeed: number;
  selectable: boolean;
  swatches: string[];
  model: CharacterModelSource;
  dances: DanceMoveId[];
}

export interface OutfitColors {
  outfit: string;
  outfitTrim: string;
  accent: string;
}

export interface OutfitDescriptor {
  id: string;
  displayName: string;
  colors: OutfitColors;
}

export interface CharacterAppearance {
  characterTypeId: string;
  outfitId: string;
}
