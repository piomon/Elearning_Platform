import { config } from "../config/env";

// Build a single agreed embed URL for a lesson video. Prefer a Bunny Stream
// iframe (library + video id), then fall back to a raw videoUrl. Returns null
// only when the video is truly unplayable (no Bunny id/library and no url).
export function buildVideoEmbedUrl(video: {
  bunnyVideoId: string | null;
  videoUrl: string | null;
}): string | null {
  if (video.bunnyVideoId && config.bunny.libraryId) {
    return `https://iframe.mediadelivery.net/embed/${config.bunny.libraryId}/${video.bunnyVideoId}?preload=true&responsive=true`;
  }
  return video.videoUrl ?? null;
}
