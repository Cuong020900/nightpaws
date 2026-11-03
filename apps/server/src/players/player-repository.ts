import { randomUUID } from "node:crypto";
import type { CharacterAppearance, PlayerProfile, PlayerWithCharacters, SavedCharacter } from "@nightpaws/shared";
import type pg from "pg";
import { withTransaction, type AppDatabase } from "../database.ts";

interface PlayerRow {
  id: string;
  display_name: string;
  active_character_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CharacterRow {
  id: string;
  player_id: string;
  character_type_id: string;
  outfit_id: string;
  created_at: Date;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlayerId(value: string): boolean {
  return uuidPattern.test(value);
}

function toProfile(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    activeCharacterId: row.active_character_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toCharacter(row: CharacterRow): SavedCharacter {
  return {
    id: row.id,
    playerId: row.player_id,
    characterTypeId: row.character_type_id,
    outfitId: row.outfit_id,
    createdAt: row.created_at.toISOString(),
  };
}

export class PlayerRepository {
  constructor(private readonly database: AppDatabase) {}

  async find(playerId: string): Promise<PlayerWithCharacters | null> {
    if (!isPlayerId(playerId)) return null;
    const players = await this.database.query<PlayerRow>("SELECT * FROM players WHERE id = $1", [playerId]);
    const playerRow = players.rows[0];
    if (!playerRow) return null;

    const characterRows = await this.database.query<CharacterRow>(
      "SELECT * FROM characters WHERE player_id = $1 ORDER BY created_at, id",
      [playerId],
    );
    const characters = characterRows.rows.map(toCharacter);

    return {
      profile: toProfile(playerRow),
      characters,
      activeCharacter: characters.find((character) => character.id === playerRow.active_character_id) ?? null,
    };
  }

  async create(displayName: string, appearance: CharacterAppearance): Promise<PlayerWithCharacters> {
    const playerId = randomUUID();
    await withTransaction(this.database, async (client) => {
      await client.query("INSERT INTO players (id, display_name) VALUES ($1, $2)", [playerId, displayName]);
      await this.activateAppearance(client, playerId, appearance);
    });
    return (await this.find(playerId))!;
  }

  async update(playerId: string, displayName: string, appearance: CharacterAppearance): Promise<PlayerWithCharacters | null> {
    if (!isPlayerId(playerId)) return null;
    const updated = await withTransaction(this.database, async (client) => {
      const result = await client.query("UPDATE players SET display_name = $1, updated_at = now() WHERE id = $2", [displayName, playerId]);
      if (result.rowCount === 0) return false;
      await this.activateAppearance(client, playerId, appearance);
      return true;
    });
    return updated ? this.find(playerId) : null;
  }

  private async activateAppearance(client: pg.PoolClient, playerId: string, appearance: CharacterAppearance): Promise<void> {
    await client.query(
      `INSERT INTO characters (id, player_id, character_type_id, outfit_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, character_type_id, outfit_id) DO NOTHING`,
      [randomUUID(), playerId, appearance.characterTypeId, appearance.outfitId],
    );
    await client.query(
      `UPDATE players SET active_character_id = (
         SELECT id FROM characters WHERE player_id = $1 AND character_type_id = $2 AND outfit_id = $3
       ) WHERE id = $1`,
      [playerId, appearance.characterTypeId, appearance.outfitId],
    );
  }
}
