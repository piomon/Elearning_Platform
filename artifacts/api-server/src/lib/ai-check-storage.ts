// Persistent storage for student AI-check photos.
//
// Every /ai/check upload is saved under <config.storageDir>/ai-checks/YYYY/MM/
// with a random file name, and the ai_checks row records the RELATIVE path
// (e.g. "ai-checks/2026/07/6f3a….png"). The files are NEVER served publicly —
// only the admin-guarded GET /api/admin/ai-checks/:id/image reads them back,
// resolving the stored relative path through resolveAiCheckImagePath() so a
// tampered DB value can never escape the storage root.
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config/env";
import type { Logger } from "pino";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Persist a validated AI-check image (base64 payload, already size- and
 * format-checked by the upload validator). Returns the relative storage path
 * to record on the ai_checks row, or null when the write fails — a broken
 * disk must never break the student's check, the admin log just loses the
 * photo preview for that one entry.
 */
export async function saveAiCheckImage(
  base64Data: string,
  mimeType: string,
  log?: Logger,
): Promise<string | null> {
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) return null;
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const relPath = path.posix.join("ai-checks", year, month, `${randomUUID()}.${ext}`);
  try {
    const absPath = path.join(config.storageDir, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, Buffer.from(base64Data, "base64"));
    return relPath;
  } catch (err) {
    log?.error({ err, relPath }, "Nie udało się zapisać obrazka sprawdzenia AI");
    return null;
  }
}

/**
 * Resolve a stored relative path to an absolute file path inside the storage
 * root. Returns null for anything that would escape the root (absolute paths,
 * "..", etc.) — defense in depth even though we only ever store safe values.
 */
export function resolveAiCheckImagePath(relPath: string): string | null {
  if (!relPath || path.isAbsolute(relPath)) return null;
  const abs = path.resolve(config.storageDir, relPath);
  const root = config.storageDir + path.sep;
  if (!abs.startsWith(root)) return null;
  return abs;
}
