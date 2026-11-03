import type { CharacterAppearance, DanceMoveId } from "./character.ts";
import { allDanceMoveIds } from "./dances.ts";
import type { RoomMusicState } from "./music.ts";

export const realtimePath = "/ws";
export const realtimeProtocolVersion = 1;

export interface PlayerPose {
  x: number;
  z: number;
  f: number;
  d: DanceMoveId | null;
}

export interface RoomPlayer extends PlayerPose {
  id: string;
  name: string;
  look: CharacterAppearance;
}

export type PlayerDelta = [id: string, x: number, z: number, f: number, dance: DanceMoveId | null, jumped: 0 | 1];

export interface RoomOccupancy {
  players: number;
  capacity: number;
  queued: number;
}

export interface RoomSummary extends RoomOccupancy {
  id: string;
  displayName: string;
}

export interface HelloMessage {
  t: "hello";
  v: number;
  room: string;
  name: string;
  look: CharacterAppearance;
  playerId?: string;
  resume?: string;
}

export type ClientMessage =
  | HelloMessage
  | ({ t: "pose" } & PlayerPose)
  | { t: "jump" }
  | { t: "look"; name: string; look: CharacterAppearance }
  | { t: "hb" }
  | { t: "leave" };

export interface WelcomeMessage {
  t: "welcome";
  you: string;
  resume: string;
  resumed: boolean;
  room: { id: string; capacity: number };
  tickMs: number;
  players: RoomPlayer[];
  music: RoomMusicState | null;
  occupancy: RoomOccupancy;
}

export interface QueuedMessage {
  t: "queued";
  position: number;
  occupancy: RoomOccupancy;
}

export type WarningCode = "rate_limited" | "invalid_message" | "position_corrected";

export type RejectionCode = "bad_hello" | "unknown_room" | "queue_full" | "kicked" | "server_busy" | "unavailable";

export type ServerMessage =
  | WelcomeMessage
  | QueuedMessage
  | { t: "join"; player: RoomPlayer }
  | { t: "leave"; id: string }
  | { t: "look"; id: string; name: string; look: CharacterAppearance }
  | { t: "tick"; p: PlayerDelta[] }
  | { t: "snapshot"; players: RoomPlayer[] }
  | { t: "music"; state: RoomMusicState }
  | ({ t: "occupancy" } & RoomOccupancy)
  | { t: "correct"; x: number; z: number }
  | { t: "warn"; code: WarningCode; message: string }
  | { t: "error"; code: RejectionCode; message: string };

export const realtimeCloseCodes = {
  normal: 1000,
  goingAway: 1001,
  policy: 1008,
  tooLarge: 1009,
  tryAgainLater: 1013,
  handshakeTimeout: 4001,
  idleTimeout: 4002,
  badHello: 4003,
  unknownRoom: 4004,
  kicked: 4008,
  replaced: 4009,
  queueFull: 4013,
} as const;

export const finalCloseCodes: ReadonlySet<number> = new Set([
  realtimeCloseCodes.badHello,
  realtimeCloseCodes.unknownRoom,
  realtimeCloseCodes.kicked,
  realtimeCloseCodes.replaced,
  realtimeCloseCodes.policy,
]);

const danceMoveIdSet: ReadonlySet<string> = new Set(allDanceMoveIds);

export function isDanceMoveId(value: unknown): value is DanceMoveId {
  return typeof value === "string" && danceMoveIdSet.has(value);
}
