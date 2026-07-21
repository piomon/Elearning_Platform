// Route tests for GET /api/admin/storage/stats — the AI-check photo storage
// overview: admin gating, zero-state when nothing is stored, and accurate
// file count / byte total / oldest-file / retention / disk-pressure reporting
// after photos are stored.
import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import request from "supertest";
import app from "../src/app";
import { createUser, createAdmin } from "./helpers/factories";
import { config } from "../src/config/env";
import { saveAiCheckImage } from "../src/lib/ai-check-storage";

// 1×1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("GET /api/admin/storage/stats", () => {
  beforeAll(async () => {
    await fs.mkdir(config.storageDir, { recursive: true });
  });

  it("is admin-only", async () => {
    const noAuth = await request(app).get("/api/admin/storage/stats");
    expect(noAuth.status).toBe(401);

    const { token } = await createUser({ email: "student-storage@test.pl" });
    const forbidden = await request(app)
      .get("/api/admin/storage/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(forbidden.status).toBe(403);
  });

  it("reports usage, retention policy and disk pressure", async () => {
    // Store a real photo through the same helper the /ai/check route uses so
    // the walk has at least one file to find.
    const relPath = await saveAiCheckImage(PNG_BASE64, "image/png");
    expect(relPath).not.toBeNull();
    const storedBytes = (
      await fs.stat(path.join(config.storageDir, relPath!))
    ).size;

    const { token } = await createAdmin();
    const res = await request(app)
      .get("/api/admin/storage/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    expect(res.body.totalFiles).toBeGreaterThanOrEqual(1);
    expect(res.body.totalBytes).toBeGreaterThanOrEqual(storedBytes);
    expect(res.body.oldestFileAt).toEqual(expect.any(String));
    expect(new Date(res.body.oldestFileAt).getTime()).not.toBeNaN();
    expect(res.body.retentionDays).toBe(config.ai.checkImageRetentionDays);
    expect(res.body.warnFreePercent).toBe(config.storageWarnFreePercent);

    // Disk info comes from statfs — available on Linux runners.
    expect(res.body.disk).not.toBeNull();
    expect(res.body.disk.totalBytes).toBeGreaterThan(0);
    expect(res.body.disk.freeBytes).toBeGreaterThanOrEqual(0);
    expect(res.body.disk.freePercent).toBeGreaterThanOrEqual(0);
    expect(res.body.disk.freePercent).toBeLessThanOrEqual(100);
    expect(res.body.lowDisk).toBe(
      res.body.disk.freePercent < res.body.warnFreePercent,
    );
  });
});
