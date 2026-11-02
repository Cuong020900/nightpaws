import type { CharacterAppearance, PlayerWithCharacters } from "@nightpaws/shared";
import { apiClient, ApiError } from "./api-client.ts";

const storageKey = "nightpaws.playerId";

function readStoredPlayerId(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function storePlayerId(playerId: string): void {
  try {
    localStorage.setItem(storageKey, playerId);
  } catch {
    return;
  }
}

export async function restorePlayer(): Promise<PlayerWithCharacters | null> {
  const playerId = readStoredPlayerId();
  if (!playerId) return null;
  try {
    return await apiClient.fetchPlayer(playerId);
  } catch {
    return null;
  }
}

export async function savePlayer(displayName: string, appearance: CharacterAppearance): Promise<PlayerWithCharacters> {
  const playerId = readStoredPlayerId();
  const body = { displayName, appearance };
  if (playerId) {
    try {
      const updated = await apiClient.updatePlayer(playerId, body);
      return updated;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
    }
  }
  const created = await apiClient.createPlayer(body);
  storePlayerId(created.profile.id);
  return created;
}
