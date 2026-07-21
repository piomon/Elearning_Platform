// Route tests for GET /api/admin/ai-checks/:id/image — the admin-only preview
// of the student's stored solution photo: admin gating, 404 for missing
// rows/paths/files, path-traversal defense, and serving a real stored file.
import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import request from "supertest";
import { db, aiChecks } from "@workspace/db";
import app from "../src/app";
import { createUser, createAdmin, seedCourse } from "./helpers/factories";
import { config } from "../src/config/env";
import { saveAiCheckImage, resolveAiCheckImagePath } from "../src/lib/ai-check-storage";

// 1×1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function insertCheck(imageStoragePath: string | null) {
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
    })
    .returning();
  return check;
}

describe("GET /api/admin/ai-checks/:id/image", () => {
  beforeAll(async () => {
    await fs.mkdir(config.storageDir, { recursive: true });
  });

  it("is admin-only", async () => {
    const check = await insertCheck("ai-checks/2026/07/x.png");
    const noAuth = await request(app).get(`/api/admin/ai-checks/${check.id}/image`);
    expect(noAuth.status).toBe(401);

    const { token } = await createUser({ email: "student@test.pl" });
    const forbidden = await request(app)
      .get(`/api/admin/ai-checks/${check.id}/image`)
      .set("Authorization", `Bearer ${token}`);
    expect(forbidden.status).toBe(403);
  });

  it("serves the stored image with the right content type", async () => {
    // Store through the same helper the /ai/check route uses.
    const relPath = await saveAiCheckImage(PNG_BASE64, "image/png");
    expect(relPath).toMatch(/^ai-checks\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/);
    const check = await insertCheck(relPath);
    const { token } = await createAdmin();

    const res = await request(app)
      .get(`/api/admin/ai-checks/${check.id}/image`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.headers["cache-control"]).toContain("private");
    expect(Buffer.from(PNG_BASE64, "base64").equals(res.body)).toBe(true);
  });

  it("404s for missing rows, rows without a stored path, and vanished files", async () => {
    const { token } = await createAdmin();

    const noRow = await request(app)
      .get("/api/admin/ai-checks/999999/image")
      .set("Authorization", `Bearer ${token}`);
    expect(noRow.status).toBe(404);

    const badId = await request(app)
      .get("/api/admin/ai-checks/abc/image")
      .set("Authorization", `Bearer ${token}`);
    expect(badId.status).toBe(404);

    // Old rows predate photo storage: path is NULL.
    const noPath = await insertCheck(null);
    const nullPath = await request(app)
      .get(`/api/admin/ai-checks/${noPath.id}/image`)
      .set("Authorization", `Bearer ${token}`);
    expect(nullPath.status).toBe(404);

    // Path recorded but file gone from disk.
    const gone = await insertCheck("ai-checks/2020/01/nie-ma-takiego-pliku.png");
    const missingFile = await request(app)
      .get(`/api/admin/ai-checks/${gone.id}/image`)
      .set("Authorization", `Bearer ${token}`);
    expect(missingFile.status).toBe(404);
  });

  it("rejects stored paths that would escape the storage root", async () => {
    expect(resolveAiCheckImagePath("../../etc/passwd")).toBeNull();
    expect(resolveAiCheckImagePath("/etc/passwd")).toBeNull();
    expect(resolveAiCheckImagePath("ai-checks/../../../etc/passwd")).toBeNull();
    expect(resolveAiCheckImagePath("")).toBeNull();
    const ok = resolveAiCheckImagePath("ai-checks/2026/07/a.png");
    expect(ok).toBe(path.join(config.storageDir, "ai-checks/2026/07/a.png"));

    const evil = await insertCheck("../../etc/passwd");
    const { token } = await createAdmin();
    const res = await request(app)
      .get(`/api/admin/ai-checks/${evil.id}/image`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
