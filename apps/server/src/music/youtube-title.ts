interface OEmbedResponse {
  title?: unknown;
}

export async function lookUpYouTubeTitle(videoId: string): Promise<string | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as OEmbedResponse;
    return typeof body.title === "string" ? body.title.slice(0, 160) : null;
  } catch {
    return null;
  }
}
