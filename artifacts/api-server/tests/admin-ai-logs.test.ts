// Route tests for GET /api/admin/ai-usage/log — the per-request AI log the
// admin panel shows: admin gating, filters (status/operation/model/e-mail
// search/date range), pagination, the join onto ai_checks (photo size, task
// and topic titles, response preview) and raw attemptLog passthrough.
import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, aiUsageLog, aiChecks } from "@workspace/db";
import app from "../src/app";
import { createUser, createAdmin, seedCourse } from "./helpers/factories";

const CHECK_ATTEMPT_LOG = [
  { attempt: 1, ok: false, httpStatus: 503, ms: 1200, reason: "overloaded" },
  { attempt: 2, ok: true, ms: 900 },
];

// Three rows spanning all operations:
//  • 10.07 "check" (completed, linked ai_checks row, Anna),
//  • 12.07 "chat" (failed 503, Anna, no check link),
//  • 15.07 "admin-test" (completed, no user).
async function seedLog() {
  const { user } = await createUser({
    email: "anna.kowalska@test.pl",
    firstName: "Anna",
    lastName: "Kowalska",
  });
  const seeded = await seedCourse();
  const [check] = await db
    .insert(aiChecks)
    .values({
      userId: user.id,
      taskId: seeded.task.id,
      topicId: seeded.topic.id,
      imageStoragePath: "ai-checks/2026/07/rysunek.png",
      aiResponse: "Świetne rozwiązanie! ".repeat(30), // > 400 chars → preview truncates
      model: "gemini-flash-latest",
      requestBytes: 123456,
      latencyMs: 2100,
      status: "completed",
    })
    .returning();

  await db.insert(aiUsageLog).values([
    {
      userId: user.id,
      aiCheckId: check.id,
      operation: "check",
      model: "gemini-flash-latest",
      status: "completed",
      attempts: 2,
      rescuedByRetry: true,
      transient429: 0,
      transient503: 1,
      attemptLog: CHECK_ATTEMPT_LOG,
      inputTokens: 1000,
      outputTokens: 200,
      totalTokens: 1200,
      estCostGrosz: "0.250000",
      latencyMs: 2100,
      createdAt: new Date("2026-07-10T10:00:00Z"),
    },
    {
      userId: user.id,
      operation: "chat",
      model: "gemini-flash-lite-latest",
      status: "failed",
      httpStatus: 503,
      attempts: 4,
      rescuedByRetry: false,
      transient429: 0,
      transient503: 4,
      attemptLog: [
        { attempt: 1, ok: false, httpStatus: 503, ms: 1000 },
        { attempt: 2, ok: false, httpStatus: 503, ms: 1100 },
        { attempt: 3, ok: false, httpStatus: 503, ms: 1200 },
        { attempt: 4, ok: false, httpStatus: 503, ms: 1300 },
      ],
      latencyMs: 8000,
      errorMessage: "The model is overloaded. Please try again later.",
      createdAt: new Date("2026-07-12T10:00:00Z"),
    },
    {
      userId: null,
      operation: "admin-test",
      model: "gemini-flash-latest",
      status: "completed",
      attempts: 1,
      latencyMs: 500,
      createdAt: new Date("2026-07-15T10:00:00Z"),
    },
  ]);

  return { user, check, seeded };
}

async function getLog(token: string, query = "") {
  return request(app)
    .get(`/api/admin/ai-usage/log${query}`)
    .set("Authorization", `Bearer ${token}`);
}

describe("GET /api/admin/ai-usage/log", () => {
  it("is admin-only", async () => {
    const noAuth = await request(app).get("/api/admin/ai-usage/log");
    expect(noAuth.status).toBe(401);

    const { token } = await createUser();
    const forbidden = await getLog(token);
    expect(forbidden.status).toBe(403);
  });

  it("returns entries newest-first with user, check join and attemptLog", async () => {
    const { check, seeded } = await seedLog();
    const { token } = await createAdmin();

    const res = await getLog(token);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.entries).toHaveLength(3);
    // Newest first: admin-test (15.07), chat (12.07), check (10.07).
    expect(res.body.entries.map((e: any) => e.operation)).toEqual([
      "admin-test",
      "chat",
      "check",
    ]);

    const checkEntry = res.body.entries[2];
    expect(checkEntry.userEmail).toBe("anna.kowalska@test.pl");
    expect(checkEntry.userName).toBe("Anna Kowalska");
    expect(checkEntry.status).toBe("completed");
    expect(checkEntry.rescuedByRetry).toBe(true);
    expect(checkEntry.attempts).toBe(2);
    expect(checkEntry.estCostGrosz).toBe(0.25);
    // Raw attempt timeline passes through unchanged.
    expect(checkEntry.attemptLog).toEqual(CHECK_ATTEMPT_LOG);
    // Join onto the linked ai_checks row.
    expect(checkEntry.checkId).toBe(check.id);
    expect(checkEntry.requestBytes).toBe(123456);
    expect(checkEntry.imageStoragePath).toBe("ai-checks/2026/07/rysunek.png");
    expect(checkEntry.aiResponsePreview).toHaveLength(400);
    expect(checkEntry.taskId).toBe(seeded.task.id);
    expect(checkEntry.taskTitle).toBe("Zadanie testowe");
    expect(checkEntry.topicTitle).toBe("Temat 1");

    // Rows without a linked check expose null check fields.
    const chatEntry = res.body.entries[1];
    expect(chatEntry.checkId).toBeNull();
    expect(chatEntry.requestBytes).toBeNull();
    expect(chatEntry.errorMessage).toContain("overloaded");

    // Distinct models for the filter dropdown, alphabetical.
    expect(res.body.models).toEqual([
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
    ]);
  });

  it("filters by status, operation and model", async () => {
    await seedLog();
    const { token } = await createAdmin();

    const failed = await getLog(token, "?status=failed");
    expect(failed.body.total).toBe(1);
    expect(failed.body.entries[0].operation).toBe("chat");
    expect(failed.body.summary.failed).toBe(1);

    const checks = await getLog(token, "?operation=check");
    expect(checks.body.total).toBe(1);
    expect(checks.body.entries[0].operation).toBe("check");
    // Summary is computed over the SAME filtered set — the avg photo size
    // comes from the joined check row.
    expect(checks.body.summary.avgRequestBytes).toBe(123456);

    const lite = await getLog(token, "?model=gemini-flash-lite-latest");
    expect(lite.body.total).toBe(1);
    expect(lite.body.entries[0].operation).toBe("chat");
  });

  it("searches by student e-mail and name", async () => {
    await seedLog();
    const { token } = await createAdmin();

    // Matches Anna's two rows; the admin-test row has no user and drops out.
    const byEmail = await getLog(token, "?search=anna.kowalska");
    expect(byEmail.body.total).toBe(2);

    const byLastName = await getLog(token, "?search=kowal");
    expect(byLastName.body.total).toBe(2);

    const nobody = await getLog(token, "?search=nie-ma-takiego");
    expect(nobody.body.total).toBe(0);
    expect(nobody.body.entries).toEqual([]);
  });

  it("filters by date range (date-only 'to' is inclusive)", async () => {
    await seedLog();
    const { token } = await createAdmin();

    const fromMid = await getLog(token, "?from=2026-07-11");
    expect(fromMid.body.total).toBe(2); // 12.07 + 15.07

    const toFirst = await getLog(token, "?to=2026-07-10");
    expect(toFirst.body.total).toBe(1); // the 10.07 row, same-day inclusive

    const narrow = await getLog(token, "?from=2026-07-11&to=2026-07-12");
    expect(narrow.body.total).toBe(1);
    expect(narrow.body.entries[0].operation).toBe("chat");
  });

  it("paginates with a stable order", async () => {
    await seedLog();
    const { token } = await createAdmin();

    const page1 = await getLog(token, "?limit=2&page=1");
    expect(page1.body.total).toBe(3);
    expect(page1.body.entries).toHaveLength(2);
    expect(page1.body.limit).toBe(2);

    const page2 = await getLog(token, "?limit=2&page=2");
    expect(page2.body.entries).toHaveLength(1);
    expect(page2.body.entries[0].operation).toBe("check");

    // Pages never overlap.
    const ids1 = page1.body.entries.map((e: any) => e.id);
    const ids2 = page2.body.entries.map((e: any) => e.id);
    for (const id of ids2) expect(ids1).not.toContain(id);
  });
});
