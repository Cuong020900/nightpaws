export interface ApiErrorBody {
  error: string;
}

export const apiRoutePatterns = {
  health: "/api/health",
  players: "/api/players",
  player: "/api/players/:playerId",
  rooms: "/api/rooms",
  roomMusic: "/api/rooms/:roomId/music",
  roomMusicRequests: "/api/rooms/:roomId/music/requests",
  roomMusicFinish: "/api/rooms/:roomId/music/finish",
} as const;

export const apiRoutes = {
  players: apiRoutePatterns.players,
  player: (playerId: string) => `/api/players/${encodeURIComponent(playerId)}`,
  rooms: apiRoutePatterns.rooms,
  roomMusic: (roomId: string) => `/api/rooms/${encodeURIComponent(roomId)}/music`,
  roomMusicRequests: (roomId: string) => `/api/rooms/${encodeURIComponent(roomId)}/music/requests`,
  roomMusicFinish: (roomId: string) => `/api/rooms/${encodeURIComponent(roomId)}/music/finish`,
} as const;
