// Retention for AI-check student photos stored under
// <storageDir>/ai-checks/YYYY/MM/*.png|jpg.
//
// Policy: files older than AI_CHECK_IMAGE_RETENTION_DAYS (default 90) are
// deleted from disk, and the imageStoragePath column on the ai_checks row is
// cleared so the admin panel never shows a dead thumbnail link.
//
// Safety properties:
//  - Only rows with a non-null imageStoragePath are touched.
//  - Each file path is validated through resolveAiCheckImagePath() — any value
//    that would escape the storage root is skipped, not deleted.
//  - DB column is cleared AFTER the file has been removed (or is already gone);
//    a crash mid-run leaves a dangling path rather than a cleared path with a
//    live file on disk — the next run will retry.
//  - Processed in batches of 200 to stay memory-friendly on large backlogs.
//  - Uses a cursor (last seen id) so pages stay stable even as rows are updated.
//  - Runs once at boot (with a short delay) then every 24 h. Failures are
//    logged and never take the server down.

import { promises as fs } from "node:fs";
import { and, gt, inArray, isNotNull, lt } from "drizzle-orm";
import { db, aiChecks } from "@workspace/db";
import { config } from "../config/env";
import { resolveAiCheckImagePath } from "./ai-check-storage";
import { logger } from "./logger";

export interface AiCheckImageRetentionResult {
  cutoff: Date;
  retentionDays: number;
  scanned: number;
  deletedFiles: number;
  alreadyMissing: number;
  skippedInvalidPath: number;
  clearedRows: number;
}

const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Cutoff timestamp: rows strictly older than this will have their photos removed. */
export function imageRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - config.ai.checkImageRetentionDays * DAY_MS);
}

/**
 * Delete expired AI-check photos from disk and clear the imageStoragePath
 * column for any row whose file has been removed. Safe to call repeatedly —
 * a run with nothing to do produces zero side effects.
 */
export async function runAiCheckImageRetention(
  now = new Date(),
): Promise<AiCheckImageRetentionResult> {
  const cutoff = imageRetentionCutoff(now);
  const retentionDays = config.ai.checkImageRetentionDays;

  let scanned = 0;
  let deletedFiles = 0;
  let alreadyMissing = 0;
  let skippedInvalidPath = 0;
  let clearedRows = 0;

  // Cursor-based pagination so pages are stable even as imageStoragePath is
  // cleared on processed rows. We advance past every row we examined (by id)
  // regardless of outcome, so a batch full of invalid-path rows never loops.
  let afterId = 0;

  while (true) {
    const rows = await db
      .select({ id: aiChecks.id, imageStoragePath: aiChecks.imageStoragePath })
      .from(aiChecks)
      .where(
        and(
          lt(aiChecks.createdAt, cutoff),
          isNotNull(aiChecks.imageStoragePath),
          gt(aiChecks.id, afterId),
        ),
      )
      .orderBy(aiChecks.id)
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;
    scanned += rows.length;
    afterId = rows[rows.length - 1]!.id;

    const idsToClear: number[] = [];

    for (const row of rows) {
      const relPath = row.imageStoragePath;
      if (!relPath) continue; // guard (IS NOT NULL filter covers this, but be explicit)

      const absPath = resolveAiCheckImagePath(relPath);
      if (!absPath) {
        // Path escaped the storage root — skip the delete and the DB clear.
        skippedInvalidPath++;
        continue;
      }

      try {
        await fs.unlink(absPath);
        deletedFiles++;
        idsToClear.push(row.id);
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          // File already gone — still clear the stale DB path.
          alreadyMissing++;
          idsToClear.push(row.id);
        } else {
          // Unexpected error (permissions, etc.) — leave the row intact so
          // the next run retries; log and continue.
          logger.warn(
            { err, relPath },
            "AI-check image retention: failed to delete file, will retry next run",
          );
        }
      }
    }

    // Clear imageStoragePath in one UPDATE for everything we successfully handled.
    if (idsToClear.length > 0) {
      await db
        .update(aiChecks)
        .set({ imageStoragePath: null })
        .where(inArray(aiChecks.id, idsToClear));
      clearedRows += idsToClear.length;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  logger.info(
    {
      aiCheckImageRetention: {
        cutoff: cutoff.toISOString(),
        retentionDays,
        scanned,
        deletedFiles,
        alreadyMissing,
        skippedInvalidPath,
        clearedRows,
      },
    },
    scanned > 0
      ? `AI-check image retention: removed ${deletedFiles} file(s), cleared ${clearedRows} row(s)`
      : "AI-check image retention: nothing to clean",
  );

  return {
    cutoff,
    retentionDays,
    scanned,
    deletedFiles,
    alreadyMissing,
    skippedInvalidPath,
    clearedRows,
  };
}

/**
 * Fire once shortly after boot, then every 24 h. Failures are logged and
 * never take the server down.
 */
export function scheduleAiCheckImageRetention(): void {
  const run = () => {
    runAiCheckImageRetention().catch((err) => {
      logger.error({ err }, "AI-check image retention run failed");
    });
  };
  // Stagger slightly after the usage-log retention boot delay (15 s) to avoid
  // hitting the DB and disk at exactly the same moment.
  setTimeout(run, 30_000).unref();
  setInterval(run, DAY_MS).unref();
}
