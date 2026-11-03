import {
  apiRoutePatterns,
  findSelectableCharacterType,
  findOutfit,
  normalizeDisplayName,
  type CharacterAppearance,
  type SavePlayerBody,
} from "@nightpaws/shared";
import type { FastifyInstance } from "fastify";
import type { PlayerRepository } from "./player-repository.ts";

const savePlayerSchema = {
  body: {
    type: "object",
    required: ["displayName", "appearance"],
    additionalProperties: false,
    properties: {
      displayName: { type: "string", maxLength: 64 },
      appearance: {
        type: "object",
        required: ["characterTypeId", "outfitId"],
        additionalProperties: false,
        properties: {
          characterTypeId: { type: "string", maxLength: 64 },
          outfitId: { type: "string", maxLength: 64 },
        },
      },
    },
  },
} as const;

type ValidatedSave = { displayName: string; appearance: CharacterAppearance } | { error: string };

function validateSave(body: SavePlayerBody): ValidatedSave {
  const displayName = normalizeDisplayName(body.displayName);
  if (!displayName) return { error: "Display name must be 2 to 18 characters." };
  if (!findSelectableCharacterType(body.appearance.characterTypeId)) return { error: "Unknown character type." };
  if (!findOutfit(body.appearance.outfitId)) return { error: "Unknown outfit." };
  return { displayName, appearance: body.appearance };
}

export function registerPlayerRoutes(app: FastifyInstance, players: PlayerRepository, savesPerMinute: number): void {
  const saveLimit = { rateLimit: { max: savesPerMinute, timeWindow: 60000 } };

  app.get<{ Params: { playerId: string } }>(apiRoutePatterns.player, async (request, reply) => {
    const player = await players.find(request.params.playerId);
    if (!player) return reply.code(404).send({ error: "Player not found." });
    return player;
  });

  app.post<{ Body: SavePlayerBody }>(apiRoutePatterns.players, { schema: savePlayerSchema, config: saveLimit }, async (request, reply) => {
    const validated = validateSave(request.body);
    if ("error" in validated) return reply.code(400).send(validated);
    return reply.code(201).send(await players.create(validated.displayName, validated.appearance));
  });

  app.put<{ Params: { playerId: string }; Body: SavePlayerBody }>(
    apiRoutePatterns.player,
    { schema: savePlayerSchema, config: saveLimit },
    async (request, reply) => {
      const validated = validateSave(request.body);
      if ("error" in validated) return reply.code(400).send(validated);
      const player = await players.update(request.params.playerId, validated.displayName, validated.appearance);
      if (!player) return reply.code(404).send({ error: "Player not found." });
      return player;
    },
  );
}
