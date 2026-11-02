import type { MusicRequest, RoomMusicState } from "@nightpaws/shared";
import type { AppDatabase } from "../database.ts";

interface MusicRequestRow {
  id: number;
  room_id: string;
  video_id: string;
  title: string | null;
  requested_by: string;
  status: "queued" | "playing" | "finished";
  requested_at: string;
  started_at: string | null;
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
    id: row.id,
    roomId: row.room_id,
    videoId: row.video_id,
    title: row.title,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
  };
}

export class MusicRepository {
  constructor(private readonly database: AppDatabase) {}

  roomState(roomId: string): RoomMusicState {
    this.promoteNextIfIdle(roomId);
    const playing = this.database
      .prepare<[string], MusicRequestRow>("SELECT * FROM music_requests WHERE room_id = ? AND status = 'playing' LIMIT 1")
      .get(roomId);
    const queued = this.database
      .prepare<[string], MusicRequestRow>("SELECT * FROM music_requests WHERE room_id = ? AND status = 'queued' ORDER BY id")
      .all(roomId);

    return {
      roomId,
      nowPlaying: playing ? { request: toMusicRequest(playing), startedAt: playing.started_at! } : null,
      queue: queued.map(toMusicRequest),
      serverTime: new Date().toISOString(),
    };
  }

  queuedCount(roomId: string): number {
    return this.database
      .prepare<[string], { total: number }>("SELECT COUNT(*) AS total FROM music_requests WHERE room_id = ? AND status = 'queued'")
      .get(roomId)!.total;
  }

  enqueue(request: NewMusicRequest): void {
    this.database
      .prepare(
        `INSERT INTO music_requests (room_id, video_id, title, requested_by, player_id, status, requested_at)
         VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
      )
      .run(request.roomId, request.videoId, request.title, request.requestedBy, request.playerId, new Date().toISOString());
  }

  finish(roomId: string, requestId: number): void {
    this.database
      .prepare("UPDATE music_requests SET status = 'finished', finished_at = ? WHERE room_id = ? AND id = ? AND status = 'playing'")
      .run(new Date().toISOString(), roomId, requestId);
  }

  private promoteNextIfIdle(roomId: string): void {
    this.database.transaction(() => {
      const playing = this.database
        .prepare<[string], { id: number }>("SELECT id FROM music_requests WHERE room_id = ? AND status = 'playing' LIMIT 1")
        .get(roomId);
      if (playing) return;
      this.database
        .prepare(
          `UPDATE music_requests SET status = 'playing', started_at = ?
           WHERE id = (SELECT id FROM music_requests WHERE room_id = ? AND status = 'queued' ORDER BY id LIMIT 1)`,
        )
        .run(new Date().toISOString(), roomId);
    })();
  }
}
