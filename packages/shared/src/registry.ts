import type { CharacterTypeDescriptor, OutfitDescriptor } from "./character.ts";
import { pandaCharacter } from "./characters/panda.ts";
import {
  blondRabbitCharacter,
  bunnyCharacter,
  cyanRabbitCharacter,
  greyRabbitCharacter,
  pandaPatronCharacter,
  pigtailRabbitCharacter,
  rabbitCharacter,
  sharkCharacter,
} from "./characters/quaternius-cast.ts";
import { outfits } from "./outfits.ts";
import type { SceneDescriptor } from "./scene.ts";
import { neonBarScene } from "./scenes/neon-bar.ts";

export const characterTypes: CharacterTypeDescriptor[] = [
  pandaCharacter,
  rabbitCharacter,
  bunnyCharacter,
  sharkCharacter,
  greyRabbitCharacter,
  blondRabbitCharacter,
  pigtailRabbitCharacter,
  cyanRabbitCharacter,
  pandaPatronCharacter,
];

export const selectableCharacterTypes: CharacterTypeDescriptor[] = characterTypes.filter((type) => type.selectable);

export const sceneDescriptors: SceneDescriptor[] = [neonBarScene];

export const defaultSceneId = neonBarScene.id;

export function findCharacterType(id: string): CharacterTypeDescriptor | undefined {
  return characterTypes.find((characterType) => characterType.id === id);
}

export function findSelectableCharacterType(id: string): CharacterTypeDescriptor | undefined {
  return selectableCharacterTypes.find((characterType) => characterType.id === id);
}

export function findOutfit(id: string): OutfitDescriptor | undefined {
  return outfits.find((outfit) => outfit.id === id);
}

export function findSceneDescriptor(id: string): SceneDescriptor | undefined {
  return sceneDescriptors.find((scene) => scene.id === id);
}

export function requireCharacterType(id: string): CharacterTypeDescriptor {
  return findCharacterType(id) ?? pandaCharacter;
}

export function requireOutfit(id: string): OutfitDescriptor {
  return findOutfit(id) ?? outfits[0]!;
}
