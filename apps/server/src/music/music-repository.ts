import type { MusicRequest, RoomMusicState } from "@nightpaws/shared";
import type pg from "pg";
import { withTransaction, type AppDatabase } from "../database.ts";
import { isPlayerId } from "../players/player-repository.ts";

interface MusicRequestRow {
  id: string;
  room_id: string;
  video_id: string;
  title: string | null;
  requested_by: string;
  status: "queued" | "playing" | "finished";
  requested_at: Date;
  started_at: Date | null;
}

export interface NewMusicRequest {
  roomId: string;
  videoId: string;
  title: string | null;
  requestedBy: string;
  playerId: string | null;
}

function toMusicRequest(row: MusicRequestRow): MusicRequest {
  return {
    id: Number(row.id),
    roomId: row.room_id,
    videoId: row.video_id,
    title: row.title,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
  };
}

async function lockRoom(client: pg.PoolClient, roomId: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('music:' || $1))", [roomId]);
}

async function promoteNextIfIdle(client: pg.PoolClient, roomId: string): Promise<void> {
  const playing = await client.query("SELECT id FROM music_requests WHERE room_id = $1 AND status = 'playing' LIMIT 1", [roomId]);
  if (playing.rowCount) return;
  await client.query(
    `UPDATE music_requests SET status = 'playing', started_at = now()
     WHERE id = (SELECT id FROM music_requests WHERE room_id = $1 AND status = 'queued' ORDER BY id LIMIT 1)`,
    [roomId],
  );
}

export class MusicRepository {
  constructor(private readonly database: AppDatabase) {}

  async roomState(roomId: string): Promise<RoomMusicState> {
    return withTransaction(this.database, async (client) => {
      await lockRoom(client, roomId);
      await promoteNextIfIdle(client, roomId);
      const rows = await client.query<MusicRequestRow>(
        "SELECT * FROM music_requests WHERE room_id = $1 AND status IN ('playing', 'queued') ORDER BY id",
        [roomId],
      );
      const now = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const playing = rows.rows.find((row) => row.status === "playing");
      return {
        roomId,
        nowPlaying: playing ? { request: toMusicRequest(playing), startedAt: playing.started_at!.toISOString() } : null,
        queue: rows.rows.filter((row) => row.status === "queued").map(toMusicRequest),
        serverTime: now.rows[0]!.now.toISOString(),
      };
    });
  }

  async enqueue(request: NewMusicRequest, maxQueued: number): Promise<boolean> {
    return withTransaction(this.database, async (client) => {
      await lockRoom(client, request.roomId);
      const queued = await client.query<{ total: string }>(
        "SELECT COUNT(*) AS total FROM music_requests WHERE room_id = $1 AND status = 'queued'",
        [request.roomId],
      );
      if (Number(queued.rows[0]!.total) >= maxQueued) return false;
      const playerId = request.playerId && isPlayerId(request.playerId) ? request.playerId : null;
      await client.query(
        `INSERT INTO music_requests (room_id, video_id, title, requested_by, player_id, status)
         VALUES ($1, $2, $3, $4, (SELECT id FROM players WHERE id = $5::uuid), 'queued')`,
        [request.roomId, request.videoId, request.title, request.requestedBy, playerId],
      );
      return true;
    });
  }

  async finish(roomId: string, requestId: number): Promise<void> {
    await this.database.query(
      "UPDATE music_requests SET status = 'finished', finished_at = now() WHERE room_id = $1 AND id = $2 AND status = 'playing'",
      [roomId, requestId],
    );
  }
}
