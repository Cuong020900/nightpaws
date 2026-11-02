export interface MusicRequest {
  id: number;
  roomId: string;
  videoId: string;
  title: string | null;
  requestedBy: string;
  requestedAt: string;
}

export interface NowPlaying {
  request: MusicRequest;
  startedAt: string;
}

export interface RoomMusicState {
  roomId: string;
  nowPlaying: NowPlaying | null;
  queue: MusicRequest[];
  serverTime: string;
}

export interface CreateMusicRequestBody {
  video: string;
  requestedBy: string;
  playerId?: string;
}

export interface FinishTrackBody {
  requestId: number;
}

export const maxQueuedRequestsPerRoom = 20;

const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (youtubeVideoIdPattern.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  const candidates: (string | null | undefined)[] = [];
  if (host === "youtu.be") candidates.push(url.pathname.split("/")[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    candidates.push(url.searchParams.get("v"));
    const [, section, id] = url.pathname.split("/");
    if (section === "embed" || section === "shorts" || section === "live" || section === "v") {
      candidates.push(id);
    }
  }

  return candidates.find((candidate): candidate is string => !!candidate && youtubeVideoIdPattern.test(candidate)) ?? null;
}

export function elapsedPlaybackSeconds(nowPlaying: NowPlaying, serverTime: string): number {
  return Math.max(0, (Date.parse(serverTime) - Date.parse(nowPlaying.startedAt)) / 1000);
}
