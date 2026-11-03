import {
  findOutfit,
  findSelectableCharacterType,
  isDanceMoveId,
  normalizeDisplayName,
  realtimeProtocolVersion,
  type CharacterAppearance,
  type ClientMessage,
} from "@nightpaws/shared";
import type { RawData } from "ws";

const coordinateLimit = 1000;
const tokenPattern = /^[A-Za-z0-9._-]{1,128}$/;

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= coordinateLimit ? value : null;
}

function shortString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

export function parseAppearance(value: unknown): CharacterAppearance | null {
  if (!isFields(value)) return null;
  const characterTypeId = shortString(value.characterTypeId, 64);
  const outfitId = shortString(value.outfitId, 64);
  if (!characterTypeId || !outfitId) return null;
  if (!findSelectableCharacterType(characterTypeId) || !findOutfit(outfitId)) return null;
  return { characterTypeId, outfitId };
}

function parseIdentity(fields: Fields): { name: string; look: CharacterAppearance } | null {
  const rawName = shortString(fields.name, 64);
  const name = rawName === null ? null : normalizeDisplayName(rawName);
  const look = parseAppearance(fields.look);
  return name && look ? { name, look } : null;
}

function rawText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return data.toString("utf8");
}

export function parseClientMessage(data: RawData, isBinary: boolean): ClientMessage | null {
  if (isBinary) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText(data));
  } catch {
    return null;
  }
  if (!isFields(parsed) || typeof parsed.t !== "string") return null;

  switch (parsed.t) {
    case "pose": {
      const x = finite(parsed.x);
      const z = finite(parsed.z);
      const f = finite(parsed.f);
      const d = parsed.d === null || parsed.d === undefined ? null : isDanceMoveId(parsed.d) ? parsed.d : undefined;
      if (x === null || z === null || f === null || d === undefined) return null;
      return { t: "pose", x, z, f, d };
    }
    case "jump":
    case "hb":
    case "leave":
      return { t: parsed.t };
    case "look": {
      const identity = parseIdentity(parsed);
      return identity ? { t: "look", ...identity } : null;
    }
    case "hello": {
      if (parsed.v !== realtimeProtocolVersion) return null;
      const room = shortString(parsed.room, 64);
      const identity = parseIdentity(parsed);
      if (!room || !identity) return null;
      const playerId = shortString(parsed.playerId, 64);
      const resume = typeof parsed.resume === "string" && tokenPattern.test(parsed.resume) ? parsed.resume : undefined;
      return {
        t: "hello",
        v: realtimeProtocolVersion,
        room,
        ...identity,
        ...(playerId ? { playerId } : {}),
        ...(resume ? { resume } : {}),
      };
    }
    default:
      return null;
  }
}
