import {
  elapsedPlaybackSeconds,
  extractYouTubeVideoId,
  maxQueuedRequestsPerRoom,
  type MusicRequest,
  type RoomMusicState,
} from "@nightpaws/shared";
import { ApiError, apiClient, isBackendUnavailable } from "../api/api-client.ts";
import { YouTubeJukebox } from "./youtube-player.ts";

const pollIntervalMs = 4000;
const livePollIntervalMs = 30000;

export interface RoomMusicListener {
  onMusicState(state: RoomMusicState | null): void;
  onPlaybackChange(isPlaying: boolean): void;
  onMusicError(message: string): void;
}

function emptyLocalState(roomId: string): RoomMusicState {
  return { roomId, nowPlaying: null, queue: [], serverTime: new Date().toISOString() };
}

export class RoomMusic {
  private readonly jukebox: YouTubeJukebox;
  private state: RoomMusicState | null = null;
  private loadedRequestId: number | null = null;
  private pollTimer: number | null = null;
  private finishing = false;
  private playbackEnabled = false;
  private roomGeneration = 0;
  private live = false;
  private local = false;
  private nextLocalRequestId = -1;

  constructor(
    private roomId: string,
    playerHost: HTMLElement,
    private readonly listener: RoomMusicListener,
  ) {
    this.jukebox = new YouTubeJukebox(playerHost, {
      onStateChange: () => {
        this.listener.onPlaybackChange(this.jukebox.isPlaying);
        if (this.jukebox.isPlaying) this.fillLocalTitle();
      },
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
    this.schedulePolling();
    await this.refresh();
  }

  setLive(live: boolean): void {
    if (this.live === live) return;
    this.live = live;
    if (live) this.local = false;
    this.schedulePolling();
    if (!live) void this.refresh();
  }

  applyLiveState(state: RoomMusicState): void {
    if (state.roomId !== this.roomId) return;
    this.local = false;
    this.applyState(state);
  }

  async startPlayback(): Promise<void> {
    this.playbackEnabled = true;
    await this.jukebox.start();
    this.syncPlayback();
  }

  async request(video: string, requestedBy: string, playerId: string | null): Promise<RoomMusicState> {
    const generation = this.roomGeneration;
    if (!this.local) {
      try {
        const state = await apiClient.requestMusic(this.roomId, { video, requestedBy, ...(playerId ? { playerId } : {}) });
        if (generation === this.roomGeneration) this.applyState(state);
        return state;
      } catch (error) {
        if (!isBackendUnavailable(error)) throw error;
        this.fallBackToLocal(error);
      }
    }
    return this.requestLocally(video, requestedBy);
  }

  switchRoom(roomId: string): void {
    if (roomId === this.roomId) return;
    this.roomId = roomId;
    this.roomGeneration += 1;
    this.state = null;
    this.listener.onMusicState(null);
    if (this.loadedRequestId !== null) {
      this.loadedRequestId = null;
      void this.jukebox.stop();
    }
    if (this.local) this.applyState(emptyLocalState(roomId));
    else void this.refresh();
  }

  toggleMute(): boolean {
    return this.jukebox.toggleMute();
  }

  dispose(): void {
    this.stopPolling();
  }

  private schedulePolling(): void {
    this.stopPolling();
    this.pollTimer = window.setInterval(() => void this.refresh(), this.live ? livePollIntervalMs : pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async refresh(): Promise<void> {
    const generation = this.roomGeneration;
    try {
      const state = await apiClient.fetchRoomMusic(this.roomId);
      if (generation !== this.roomGeneration) return;
      this.local = false;
      this.applyState(state);
    } catch (error) {
      if (generation !== this.roomGeneration) return;
      if (isBackendUnavailable(error)) this.fallBackToLocal(error);
      else this.listener.onMusicState(this.state);
    }
  }

  private fallBackToLocal(error: unknown): void {
    if (error instanceof ApiError) this.stopPolling();
    if (this.local) return;
    this.local = true;
    this.applyState(this.state ?? emptyLocalState(this.roomId));
  }

  private requestLocally(video: string, requestedBy: string): RoomMusicState {
    const videoId = extractYouTubeVideoId(video);
    if (!videoId) throw new Error("That does not look like a YouTube link or video id.");
    const current = this.state ?? emptyLocalState(this.roomId);
    if (current.queue.length >= maxQueuedRequestsPerRoom) throw new Error("The queue is full. Try again after a few songs.");
    const now = new Date().toISOString();
    const request: MusicRequest = {
      id: this.nextLocalRequestId--,
      roomId: this.roomId,
      videoId,
      title: null,
      requestedBy,
      requestedAt: now,
    };
    const state: RoomMusicState = current.nowPlaying
      ? { ...current, queue: [...current.queue, request], serverTime: now }
      : { ...current, nowPlaying: { request, startedAt: now }, serverTime: now };
    this.applyState(state);
    return state;
  }

  private advanceLocally(requestId: number): void {
    const current = this.state;
    if (!current?.nowPlaying || current.nowPlaying.request.id !== requestId) return;
    const [next, ...queue] = current.queue;
    const now = new Date().toISOString();
    this.applyState({ ...current, nowPlaying: next ? { request: next, startedAt: now } : null, queue, serverTime: now });
  }

  private fillLocalTitle(): void {
    const nowPlaying = this.state?.nowPlaying;
    if (!this.local || !nowPlaying || nowPlaying.request.title || nowPlaying.request.id !== this.loadedRequestId) return;
    const title = this.jukebox.videoTitle;
    if (!title) return;
    this.state = { ...this.state!, nowPlaying: { ...nowPlaying, request: { ...nowPlaying.request, title } } };
    this.listener.onMusicState(this.state);
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
    if (this.local) {
      this.advanceLocally(requestId);
      return;
    }
    this.finishing = true;
    const generation = this.roomGeneration;
    try {
      const state = await apiClient.finishTrack(this.roomId, { requestId });
      if (generation === this.roomGeneration) this.applyState(state);
    } catch (error) {
      if (generation !== this.roomGeneration) return;
      if (isBackendUnavailable(error)) {
        this.fallBackToLocal(error);
        this.advanceLocally(requestId);
      } else {
        this.listener.onMusicError("Lost contact with the DJ booth.");
      }
    } finally {
      this.finishing = false;
    }
  }
}
