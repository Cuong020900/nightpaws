import { randomUUID } from "node:crypto";
import type { CharacterAppearance, PlayerProfile, PlayerWithCharacters, SavedCharacter } from "@nightpaws/shared";
import type { AppDatabase } from "../database.ts";

interface PlayerRow {
  id: string;
  display_name: string;
  active_character_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CharacterRow {
  id: string;
  player_id: string;
  character_type_id: string;
  outfit_id: string;
  created_at: string;
}

function toProfile(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    activeCharacterId: row.active_character_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCharacter(row: CharacterRow): SavedCharacter {
  return {
    id: row.id,
    playerId: row.player_id,
    characterTypeId: row.character_type_id,
    outfitId: row.outfit_id,
    createdAt: row.created_at,
  };
}

export class PlayerRepository {
  constructor(private readonly database: AppDatabase) {}

  find(playerId: string): PlayerWithCharacters | null {
    const playerRow = this.database
      .prepare<[string], PlayerRow>("SELECT * FROM players WHERE id = ?")
      .get(playerId);
    if (!playerRow) return null;

    const characters = this.database
      .prepare<[string], CharacterRow>("SELECT * FROM characters WHERE player_id = ? ORDER BY created_at")
      .all(playerId)
      .map(toCharacter);

    return {
      profile: toProfile(playerRow),
      characters,
      activeCharacter: characters.find((character) => character.id === playerRow.active_character_id) ?? null,
    };
  }

  create(displayName: string, appearance: CharacterAppearance): PlayerWithCharacters {
    const playerId = randomUUID();
    const now = new Date().toISOString();
    this.database.transaction(() => {
      this.database
        .prepare("INSERT INTO players (id, display_name, active_character_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)")
        .run(playerId, displayName, now, now);
      this.activateAppearance(playerId, appearance, now);
    })();
    return this.find(playerId)!;
  }

  update(playerId: string, displayName: string, appearance: CharacterAppearance): PlayerWithCharacters | null {
    if (!this.find(playerId)) return null;
    const now = new Date().toISOString();
    this.database.transaction(() => {
      this.database
        .prepare("UPDATE players SET display_name = ?, updated_at = ? WHERE id = ?")
        .run(displayName, now, playerId);
      this.activateAppearance(playerId, appearance, now);
    })();
    return this.find(playerId);
  }

  private activateAppearance(playerId: string, appearance: CharacterAppearance, now: string): void {
    this.database
      .prepare(
        `INSERT INTO characters (id, player_id, character_type_id, outfit_id, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (player_id, character_type_id, outfit_id) DO NOTHING`,
      )
      .run(randomUUID(), playerId, appearance.characterTypeId, appearance.outfitId, now);

    const character = this.database
      .prepare<[string, string, string], { id: string }>(
        "SELECT id FROM characters WHERE player_id = ? AND character_type_id = ? AND outfit_id = ?",
      )
      .get(playerId, appearance.characterTypeId, appearance.outfitId)!;

    this.database
      .prepare("UPDATE players SET active_character_id = ? WHERE id = ?")
      .run(character.id, playerId);
  }
}
