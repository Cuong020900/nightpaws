import {
  apiRoutes,
  type ApiErrorBody,
  type CreateMusicRequestBody,
  type FinishTrackBody,
  type PlayerWithCharacters,
  type RoomMusicState,
  type SavePlayerBody,
} from "@nightpaws/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const body = (await response.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export const apiClient = {
  fetchPlayer: (playerId: string) => requestJson<PlayerWithCharacters>(apiRoutes.player(playerId)),

  createPlayer: (body: SavePlayerBody) =>
    requestJson<PlayerWithCharacters>(apiRoutes.players, { method: "POST", body: JSON.stringify(body) }),

  updatePlayer: (playerId: string, body: SavePlayerBody) =>
    requestJson<PlayerWithCharacters>(apiRoutes.player(playerId), { method: "PUT", body: JSON.stringify(body) }),

  fetchRoomMusic: (roomId: string) => requestJson<RoomMusicState>(apiRoutes.roomMusic(roomId)),

  requestMusic: (roomId: string, body: CreateMusicRequestBody) =>
    requestJson<RoomMusicState>(apiRoutes.roomMusicRequests(roomId), { method: "POST", body: JSON.stringify(body) }),

  finishTrack: (roomId: string, body: FinishTrackBody) =>
    requestJson<RoomMusicState>(apiRoutes.roomMusicFinish(roomId), { method: "POST", body: JSON.stringify(body) }),
};
