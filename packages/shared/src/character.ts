export type Vector3Tuple = [number, number, number];

export type BoneName =
  | "root"
  | "hips"
  | "torso"
  | "head"
  | "armLeft"
  | "armRight"
  | "legLeft"
  | "legRight"
  | "tail";

export type PartShape = "sphere" | "box" | "capsule" | "cylinder" | "cone" | "torus";

export type PaletteSlot =
  | "fur"
  | "furSecondary"
  | "belly"
  | "eyePatch"
  | "eye"
  | "nose"
  | "outfit"
  | "outfitTrim"
  | "accent";

export type CharacterPalette = Record<PaletteSlot, string>;

export interface CharacterPartDescriptor {
  id: string;
  bone: BoneName;
  shape: PartShape;
  size: Vector3Tuple;
  offset: Vector3Tuple;
  rotation?: Vector3Tuple;
  colorSlot: PaletteSlot;
  mirrored?: boolean;
  outlined?: boolean;
  glossy?: boolean;
}

export interface BipedRigProportions {
  hipHeight: number;
  hipWidth: number;
  torsoHeight: number;
  shoulderWidth: number;
  neckHeight: number;
  tailHeight: number;
}

export type AnimationClipId =
  | "idle-breathe"
  | "idle-sway"
  | "walk-waddle"
  | "walk-bounce"
  | "dance-bounce"
  | "dance-disco"
  | "dance-wave"
  | "dance-spin";

export interface CharacterAnimationSet {
  idle: AnimationClipId;
  walk: AnimationClipId;
  dances: AnimationClipId[];
}

export interface CharacterTypeDescriptor {
  id: string;
  displayName: string;
  tagline: string;
  scale: number;
  walkSpeed: number;
  rig: BipedRigProportions;
  basePalette: CharacterPalette;
  parts: CharacterPartDescriptor[];
  animations: CharacterAnimationSet;
}

export interface OutfitDescriptor {
  id: string;
  displayName: string;
  colors: Pick<CharacterPalette, "outfit" | "outfitTrim" | "accent">;
}

export interface CharacterAppearance {
  characterTypeId: string;
  outfitId: string;
}

export function resolveCharacterPalette(
  characterType: CharacterTypeDescriptor,
  outfit: OutfitDescriptor,
): CharacterPalette {
  return { ...characterType.basePalette, ...outfit.colors };
}
