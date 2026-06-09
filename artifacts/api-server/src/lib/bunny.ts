import { config, bunnyReadKey, isBunnyConfigured } from "../config/env";

// Bunny Stream encode status codes returned by the video object `status` field.
// https://docs.bunny.net/reference/video_getvideo
export const BUNNY_STATUS_LABELS: Record<number, string> = {
  0: "Utworzono",
  1: "Przesłano",
  2: "Przetwarzanie",
  3: "Transkodowanie",
  4: "Gotowe",
  5: "Błąd",
  6: "Przesyłanie nieudane",
};

export type BunnyVideoHealth =
  | {
      ok: true;
      status: number;
      statusLabel: string;
      available: boolean;
      title: string | null;
      lengthSeconds: number | null;
      encodeProgress: number | null;
    }
  | { ok: false; error: string; httpStatus: number | null };

// Probe a single Bunny Stream video by GUID. Returns a normalized health
// object. A video is considered "available" only when fully encoded (status 4).
export async function probeBunnyVideo(guid: string): Promise<BunnyVideoHealth> {
  if (!isBunnyConfigured() || !config.bunny.libraryId) {
    return { ok: false, error: "Bunny nie jest skonfigurowane", httpStatus: null };
  }
  const key = bunnyReadKey();
  if (!key) {
    return { ok: false, error: "Brak klucza API Bunny", httpStatus: null };
  }

  const url = `https://video.bunnycdn.com/library/${config.bunny.libraryId}/videos/${guid}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { AccessKey: key, accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 404
            ? "Film nie istnieje w bibliotece Bunny"
            : `Bunny zwróciło ${res.status}`,
        httpStatus: res.status,
      };
    }
    const data = (await res.json()) as {
      status?: number;
      title?: string;
      length?: number;
      encodeProgress?: number;
    };
    const status = typeof data.status === "number" ? data.status : -1;
    return {
      ok: true,
      status,
      statusLabel: BUNNY_STATUS_LABELS[status] ?? "Nieznany",
      available: status === 4,
      title: data.title ?? null,
      lengthSeconds: typeof data.length === "number" ? data.length : null,
      encodeProgress:
        typeof data.encodeProgress === "number" ? data.encodeProgress : null,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === "AbortError"
          ? "Przekroczono czas oczekiwania na odpowiedź Bunny"
          : "Błąd połączenia z Bunny",
      httpStatus: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Run an async mapper over items with a bounded concurrency so a full-library
// health probe does not open dozens of simultaneous Bunny connections.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
