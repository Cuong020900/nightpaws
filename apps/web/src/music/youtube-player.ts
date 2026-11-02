interface YouTubePlayerHandle {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  stopVideo(): void;
  playVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getPlayerState(): number;
}

interface YouTubePlayerEvent {
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: (event: YouTubePlayerEvent) => void;
      };
    },
  ) => YouTubePlayerHandle;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const youtubePlayerStates = { ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

let apiLoading: Promise<YouTubeNamespace> | null = null;

function loadIframeApi(): Promise<YouTubeNamespace> {
  if (apiLoading) return apiLoading;
  apiLoading = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Could not load the YouTube player."));
    document.head.append(script);
  });
  return apiLoading;
}

export interface YouTubeJukeboxEvents {
  onStateChange: (state: number) => void;
  onTrackEnded: () => void;
  onTrackFailed: (errorCode: number) => void;
}

export class YouTubeJukebox {
  private player: YouTubePlayerHandle | null = null;
  private ready: Promise<void> | null = null;
  private state = -1;

  constructor(
    private readonly host: HTMLElement,
    private readonly events: YouTubeJukeboxEvents,
  ) {}

  get isPlaying(): boolean {
    return this.state === youtubePlayerStates.playing;
  }

  get muted(): boolean {
    return this.player?.isMuted() ?? false;
  }

  start(): Promise<void> {
    this.ready ??= loadIframeApi().then(
      (youtube) =>
        new Promise<void>((resolve) => {
          const mount = document.createElement("div");
          this.host.append(mount);
          this.player = new youtube.Player(mount, {
            width: "100%",
            height: "100%",
            playerVars: { autoplay: 1, controls: 1, playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
            events: {
              onReady: () => {
                this.player?.setVolume(80);
                resolve();
              },
              onStateChange: (event) => {
                this.state = event.data;
                this.events.onStateChange(event.data);
                if (event.data === youtubePlayerStates.ended) this.events.onTrackEnded();
              },
              onError: (event) => this.events.onTrackFailed(event.data),
            },
          });
        }),
    );
    return this.ready;
  }

  async play(videoId: string, startSeconds: number): Promise<void> {
    await this.start();
    this.player?.loadVideoById({ videoId, startSeconds: Math.floor(startSeconds) });
  }

  async stop(): Promise<void> {
    if (!this.player) return;
    this.player.stopVideo();
    this.state = youtubePlayerStates.ended;
    this.events.onStateChange(this.state);
  }

  toggleMute(): boolean {
    if (!this.player) return false;
    if (this.player.isMuted()) this.player.unMute();
    else this.player.mute();
    return !this.player.isMuted();
  }
}
