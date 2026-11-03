import type { RoomMusicState } from "@nightpaws/shared";
import type { MusicRepository, NewMusicRequest } from "./music-repository.ts";

export type MusicListener = (state: RoomMusicState) => void;

function signature(state: RoomMusicState): string {
  const playing = state.nowPlaying ? `${state.nowPlaying.request.id}@${state.nowPlaying.startedAt}` : "-";
  return `${playing}|${state.queue.map((request) => request.id).join(",")}`;
}

export class MusicService {
  private readonly lastSignatures = new Map<string, string>();
  private listener: MusicListener | null = null;

  constructor(private readonly repository: MusicRepository) {}

  onChange(listener: MusicListener): void {
    this.listener = listener;
  }

  async state(roomId: string): Promise<RoomMusicState> {
    const state = await this.repository.roomState(roomId);
    const next = signature(state);
    if (this.lastSignatures.get(roomId) !== next) {
      this.lastSignatures.set(roomId, next);
      this.listener?.(state);
    }
    return state;
  }

  noteRemoteState(state: RoomMusicState): void {
    this.lastSignatures.set(state.roomId, signature(state));
  }

  async enqueue(request: NewMusicRequest, maxQueued: number): Promise<RoomMusicState | null> {
    const accepted = await this.repository.enqueue(request, maxQueued);
    if (!accepted) return null;
    return this.state(request.roomId);
  }

  async finish(roomId: string, requestId: number): Promise<RoomMusicState> {
    await this.repository.finish(roomId, requestId);
    return this.state(roomId);
  }
}
