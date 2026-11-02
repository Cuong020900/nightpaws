import type { CharacterAppearance } from "./character.ts";

export interface PlayerProfile {
  id: string;
  displayName: string;
  activeCharacterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedCharacter {
  id: string;
  playerId: string;
  characterTypeId: string;
  outfitId: string;
  createdAt: string;
}

export interface PlayerWithCharacters {
  profile: PlayerProfile;
  characters: SavedCharacter[];
  activeCharacter: SavedCharacter | null;
}

export interface SavePlayerBody {
  displayName: string;
  appearance: CharacterAppearance;
}

export const displayNameLimits = { min: 2, max: 18 } as const;

export function normalizeDisplayName(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length < displayNameLimits.min || collapsed.length > displayNameLimits.max) return null;
  return collapsed;
}
