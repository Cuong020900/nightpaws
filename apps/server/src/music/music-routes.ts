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
import type { MusicRepository } from "./music-repository.ts";
import { lookUpYouTubeTitle } from "./youtube-title.ts";

type RoomParams = { roomId: string };

const createRequestSchema = {
  body: {
    type: "object",
    required: ["video", "requestedBy"],
    properties: {
      video: { type: "string", maxLength: 300 },
      requestedBy: { type: "string", maxLength: 64 },
      playerId: { type: "string", maxLength: 64 },
    },
  },
} as const;

const finishSchema = {
  body: {
    type: "object",
    required: ["requestId"],
    properties: { requestId: { type: "integer" } },
  },
} as const;

function rejectUnknownRoom(roomId: string, reply: FastifyReply): boolean {
  const scene = findSceneDescriptor(roomId);
  if (scene?.hasMusic) return false;
  void reply.code(404).send({ error: "Room not found." });
  return true;
}

export function registerMusicRoutes(app: FastifyInstance, music: MusicRepository): void {
  app.get<{ Params: RoomParams }>(apiRoutePatterns.roomMusic, async (request, reply) => {
    if (rejectUnknownRoom(request.params.roomId, reply)) return reply;
    return music.roomState(request.params.roomId);
  });

  app.post<{ Params: RoomParams; Body: CreateMusicRequestBody }>(
    apiRoutePatterns.roomMusicRequests,
    { schema: createRequestSchema },
    async (request, reply) => {
      const { roomId } = request.params;
      if (rejectUnknownRoom(roomId, reply)) return reply;

      const videoId = extractYouTubeVideoId(request.body.video);
      if (!videoId) return reply.code(400).send({ error: "That does not look like a YouTube link or video id." });
      const requestedBy = normalizeDisplayName(request.body.requestedBy) ?? "Guest";
      if (music.queuedCount(roomId) >= maxQueuedRequestsPerRoom) {
        return reply.code(429).send({ error: "The queue is full. Try again after a few songs." });
      }

      const title = await lookUpYouTubeTitle(videoId);
      music.enqueue({ roomId, videoId, title, requestedBy, playerId: request.body.playerId ?? null });
      return reply.code(201).send(music.roomState(roomId));
    },
  );

  app.post<{ Params: RoomParams; Body: FinishTrackBody }>(
    apiRoutePatterns.roomMusicFinish,
    { schema: finishSchema },
    async (request, reply) => {
      const { roomId } = request.params;
      if (rejectUnknownRoom(roomId, reply)) return reply;
      music.finish(roomId, request.body.requestId);
      return music.roomState(roomId);
    },
  );
}
