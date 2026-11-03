import {
  apiRoutePatterns,
  extractYouTubeVideoId,
  findSceneDescriptor,
  maxQueuedRequestsPerRoom,
  normalizeDisplayName,
  type CreateMusicRequestBody,
  type FinishTrackBody,
} from "@nightpaws/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { MusicService } from "./music-service.ts";
import { lookUpYouTubeTitle } from "./youtube-title.ts";

type RoomParams = { roomId: string };

const roomParamsSchema = {
  type: "object",
  required: ["roomId"],
  properties: { roomId: { type: "string", maxLength: 64 } },
} as const;

const createRequestSchema = {
  params: roomParamsSchema,
  body: {
    type: "object",
    required: ["video", "requestedBy"],
    additionalProperties: false,
    properties: {
      video: { type: "string", maxLength: 300 },
      requestedBy: { type: "string", maxLength: 64 },
      playerId: { type: "string", maxLength: 64 },
    },
  },
} as const;

const finishSchema = {
  params: roomParamsSchema,
  body: {
    type: "object",
    required: ["requestId"],
    additionalProperties: false,
    properties: { requestId: { type: "integer", minimum: 1 } },
  },
} as const;

function rejectUnknownRoom(roomId: string, reply: FastifyReply): boolean {
  const scene = findSceneDescriptor(roomId);
  if (scene?.hasMusic) return false;
  void reply.code(404).send({ error: "Room not found." });
  return true;
}

export interface MusicRouteLimits {
  requestsPerMinute: number;
}

export function registerMusicRoutes(app: FastifyInstance, music: MusicService, limits: MusicRouteLimits): void {
  app.get<{ Params: RoomParams }>(apiRoutePatterns.roomMusic, { schema: { params: roomParamsSchema } }, async (request, reply) => {
    if (rejectUnknownRoom(request.params.roomId, reply)) return reply;
    return music.state(request.params.roomId);
  });

  app.post<{ Params: RoomParams; Body: CreateMusicRequestBody }>(
    apiRoutePatterns.roomMusicRequests,
    { schema: createRequestSchema, config: { rateLimit: { max: limits.requestsPerMinute, timeWindow: 60000 } } },
    async (request, reply) => {
      const { roomId } = request.params;
      if (rejectUnknownRoom(roomId, reply)) return reply;

      const videoId = extractYouTubeVideoId(request.body.video);
      if (!videoId) return reply.code(400).send({ error: "That does not look like a YouTube link or video id." });
      const requestedBy = normalizeDisplayName(request.body.requestedBy) ?? "Guest";

      const title = await lookUpYouTubeTitle(videoId);
      const state = await music.enqueue(
        { roomId, videoId, title, requestedBy, playerId: request.body.playerId ?? null },
        maxQueuedRequestsPerRoom,
      );
      if (!state) return reply.code(429).send({ error: "The queue is full. Try again after a few songs." });
      return reply.code(201).send(state);
    },
  );

  app.post<{ Params: RoomParams; Body: FinishTrackBody }>(
    apiRoutePatterns.roomMusicFinish,
    { schema: finishSchema, config: { rateLimit: { max: 30, timeWindow: 60000 } } },
    async (request, reply) => {
      const { roomId } = request.params;
      if (rejectUnknownRoom(roomId, reply)) return reply;
      return music.finish(roomId, request.body.requestId);
    },
  );
}
