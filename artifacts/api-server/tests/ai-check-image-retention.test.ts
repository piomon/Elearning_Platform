// Tests for lib/ai-check-image-retention.ts (runAiCheckImageRetention):
// expired AI-check photos are deleted from disk and their imageStoragePath
// cleared; fresh rows are untouched (file kept, column intact); rows whose
// file is already gone (ENOENT) still get their stale path cleared without
// throwing; path-traversal values are skipped, not deleted, and not cleared.
import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import { eq } from "drizzle-orm";
import { db, aiChecks } from "@workspace/db";
import { createUser, seedCourse } from "./helpers/factories";
import { config } from "../src/config/env";
import { saveAiCheckImage } from "../src/lib/ai-check-storage";
import {
  runAiCheckImageRetention,
  imageRetentionCutoff,
} from "../src/lib/ai-check-image-retention";

// 1×1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const NOW = new Date("2026-07-21T12:00:00Z");

function daysAroundCutoff(days: number): Date {
  // Positive = older than the cutoff, negative = fresher.
  return new Date(imageRetentionCutoff(NOW).getTime() - days * 24 * 60 * 60 * 1000);
}

async function insertCheck(imageStoragePath: string | null, createdAt: Date) {
  const { user } = await createUser();
  const seeded = await seedCourse();
  const [check] = await db
    .insert(aiChecks)
    .values({
      userId: user.id,
      taskId: seeded.task.id,
      topicId: seeded.topic.id,
      imageStoragePath,
      model: "gemini-flash-latest",
      requestBytes: 100,
      latencyMs: 1000,
      status: "completed",
      createdAt,
    })
    .returning();
  return check!;
}

async function fileExists(relPath: string): Promise<boolean> {
  try {
    await fs.access(`${config.storageDir}/${relPath}`);
    return true;
  } catch {
    return false;
  }
}

async function storedPath(id: number): Promise<string | null> {
  const [row] = await db
    .select({ imageStoragePath: aiChecks.imageStoragePath })
    .from(aiChecks)
    .where(eq(aiChecks.id, id));
  return row!.imageStoragePath;
}

describe("runAiCheckImageRetention", () => {
  beforeAll(async () => {
    await fs.mkdir(config.storageDir, { recursive: true });
  });

  it("deletes expired files + clears their rows, leaves fresh rows alone", async () => {
    const oldRel1 = await saveAiCheckImage(PNG_BASE64, "image/png");
    const oldRel2 = await saveAiCheckImage(PNG_BASE64, "image/png");
    const freshRel = await saveAiCheckImage(PNG_BASE64, "image/png");
    expect(oldRel1 && oldRel2 && freshRel).toBeTruthy();

    const old1 = await insertCheck(oldRel1!, daysAroundCutoff(2));
    const old2 = await insertCheck(oldRel2!, daysAroundCutoff(30));
    const fresh = await insertCheck(freshRel!, daysAroundCutoff(-1));

    const result = await runAiCheckImageRetention(NOW);

    expect(result.deletedFiles).toBe(2);
    expect(result.clearedRows).toBe(2);
    expect(result.alreadyMissing).toBe(0);
    expect(result.skippedInvalidPath).toBe(0);

    // Old: files gone, DB paths cleared.
    expect(await fileExists(oldRel1!)).toBe(false);
    expect(await fileExists(oldRel2!)).toBe(false);
    expect(await storedPath(old1.id)).toBeNull();
    expect(await storedPath(old2.id)).toBeNull();

    // Fresh: file intact, DB column unchanged.
    expect(await fileExists(freshRel!)).toBe(true);
    expect(await storedPath(fresh.id)).toBe(freshRel);

    // Idempotent: second run has nothing left to do.
    const again = await runAiCheckImageRetention(NOW);
    expect(again.deletedFiles).toBe(0);
    expect(again.clearedRows).toBe(0);
    expect(await fileExists(freshRel!)).toBe(true);
  });

  it("clears the stale path without throwing when the file is already gone (ENOENT)", async () => {
    const gone = await insertCheck(
      "ai-checks/2020/01/nie-ma-takiego-pliku.png",
      daysAroundCutoff(10),
    );

    const result = await runAiCheckImageRetention(NOW);

    expect(result.alreadyMissing).toBe(1);
    expect(result.clearedRows).toBe(1);
    expect(result.deletedFiles).toBe(0);
    expect(await storedPath(gone.id)).toBeNull();
  });

  it("skips path-traversal values: no delete, DB path left intact for inspection", async () => {
    const evil = await insertCheck("../../etc/passwd", daysAroundCutoff(10));

    const result = await runAiCheckImageRetention(NOW);

    expect(result.skippedInvalidPath).toBe(1);
    expect(result.clearedRows).toBe(0);
    expect(await storedPath(evil.id)).toBe("../../etc/passwd");
  });
});
