import { elapsedPlaybackSeconds, type RoomMusicState } from "@nightpaws/shared";
import { apiClient } from "../api/api-client.ts";
import { YouTubeJukebox } from "./youtube-player.ts";

const pollIntervalMs = 4000;

export interface RoomMusicListener {
  onMusicState(state: RoomMusicState | null): void;
  onPlaybackChange(isPlaying: boolean): void;
  onMusicError(message: string): void;
}

export class RoomMusic {
  private readonly jukebox: YouTubeJukebox;
  private state: RoomMusicState | null = null;
  private loadedRequestId: number | null = null;
  private pollTimer: number | null = null;
  private finishing = false;
  private playbackEnabled = false;

  constructor(
    private readonly roomId: string,
    playerHost: HTMLElement,
    private readonly listener: RoomMusicListener,
  ) {
    this.jukebox = new YouTubeJukebox(playerHost, {
      onStateChange: () => this.listener.onPlaybackChange(this.jukebox.isPlaying),
      onTrackEnded: () => void this.finishCurrentTrack(),
      onTrackFailed: (code) => {
        this.listener.onMusicError(
          code === 101 || code === 150 ? "That video can't be embedded — skipping." : "Couldn't play that video — skipping.",
        );
        void this.finishCurrentTrack();
      },
    });
  }

  get isPlaying(): boolean {
    return this.jukebox.isPlaying;
  }

  get currentState(): RoomMusicState | null {
    return this.state;
  }

  async connect(): Promise<void> {
    await this.refresh();
    this.pollTimer = window.setInterval(() => void this.refresh(), pollIntervalMs);
  }

  async startPlayback(): Promise<void> {
    this.playbackEnabled = true;
    await this.jukebox.start();
    this.syncPlayback();
  }

  async request(video: string, requestedBy: string, playerId: string | null): Promise<RoomMusicState> {
    const state = await apiClient.requestMusic(this.roomId, { video, requestedBy, ...(playerId ? { playerId } : {}) });
    this.applyState(state);
    return state;
  }

  toggleMute(): boolean {
    return this.jukebox.toggleMute();
  }

  dispose(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
  }

  private async refresh(): Promise<void> {
    try {
      this.applyState(await apiClient.fetchRoomMusic(this.roomId));
    } catch {
      this.listener.onMusicState(this.state);
    }
  }

  private applyState(state: RoomMusicState): void {
    this.state = state;
    this.listener.onMusicState(state);
    this.syncPlayback();
  }

  private syncPlayback(): void {
    if (!this.playbackEnabled) return;
    const nowPlaying = this.state?.nowPlaying ?? null;
    if (!nowPlaying) {
      if (this.loadedRequestId !== null) {
        this.loadedRequestId = null;
        void this.jukebox.stop();
      }
      return;
    }
    if (nowPlaying.request.id === this.loadedRequestId) return;
    this.loadedRequestId = nowPlaying.request.id;
    void this.jukebox.play(nowPlaying.request.videoId, elapsedPlaybackSeconds(nowPlaying, this.state!.serverTime));
  }

  private async finishCurrentTrack(): Promise<void> {
    const requestId = this.loadedRequestId;
    if (requestId === null || this.finishing) return;
    this.finishing = true;
    try {
      this.applyState(await apiClient.finishTrack(this.roomId, { requestId }));
    } catch {
      this.listener.onMusicError("Lost contact with the DJ booth.");
    } finally {
      this.finishing = false;
    }
  }
}
