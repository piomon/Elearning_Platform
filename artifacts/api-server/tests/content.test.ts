import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, pricingSettings, payments, sections, topics, quizzes, courses } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../src/app";
import { createUser, createAdmin, seedCourse, grantAccess } from "./helpers/factories";

// Writes the singleton pricing row (id = 1). The per-test TRUNCATE clears it, so
// each test starts from a known price instead of the env-config fallback.
async function setPricing(
  values: Partial<typeof pricingSettings.$inferInsert> = {},
) {
  await db
    .insert(pricingSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: pricingSettings.id, set: { ...values } });
}

// The page price MUST equal the amount Paynow is asked to charge. Both read from
// the same pricing singleton, so these tests pin that they can never drift.
describe("Price is a single source of truth", () => {
  it("GET /payments/price reflects the stored pricing singleton", async () => {
    await setPricing({
      priceGrosz: 4200,
      oldPriceGrosz: 19900,
      currency: "PLN",
      promoEnabled: true,
      promoLabel: "Promo testowe",
      ctaText: "Kup teraz",
    });
    const res = await request(app).get("/api/payments/price");
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(4200);
    expect(res.body.oldPrice).toBe(19900);
    expect(res.body.currency).toBe("PLN");
    expect(res.body.promoEnabled).toBe(true);
    expect(res.body.promoLabel).toBe("Promo testowe");
    expect(res.body.ctaText).toBe("Kup teraz");
  });

  it("a created payment is charged exactly the displayed price", async () => {
    await setPricing({ priceGrosz: 4200, currency: "PLN" });
    const { token } = await createUser();
    const { course } = await seedCourse();

    const price = await request(app).get("/api/payments/price");
    expect(price.status).toBe(200);

    const create = await request(app)
      .post("/api/payments/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id });
    expect(create.status).toBe(200);

    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, create.body.paymentId))
      .limit(1);
    // The charged amount equals the page price exactly — never a stale constant.
    expect(row.amount).toBe(price.body.price);
    expect(row.amount).toBe(4200);
    expect(row.currency).toBe(price.body.currency);
  });

  it("an admin price change is immediately reflected for buyers", async () => {
    await setPricing({ priceGrosz: 3500, currency: "PLN" });
    const { token: adminToken } = await createAdmin();

    const update = await request(app)
      .put("/api/admin/pricing")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ priceGrosz: 5900, oldPriceGrosz: 19900, currency: "PLN" });
    expect(update.status).toBe(200);

    const price = await request(app).get("/api/payments/price");
    expect(price.body.price).toBe(5900);

    const { token } = await createUser();
    const { course } = await seedCourse();
    const create = await request(app)
      .post("/api/payments/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id });
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, create.body.paymentId))
      .limit(1);
    expect(row.amount).toBe(5900);
  });
});

describe("PUT /admin/pricing validation", () => {
  it("rejects a non-positive price (400)", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .put("/api/admin/pricing")
      .set("Authorization", `Bearer ${token}`)
      .send({ priceGrosz: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects an old price lower than the current price (400)", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .put("/api/admin/pricing")
      .set("Authorization", `Bearer ${token}`)
      .send({ priceGrosz: 5000, oldPriceGrosz: 4000 });
    expect(res.status).toBe(400);
  });
});

// `status` is the authoritative visibility flag; anything other than "published"
// must be invisible to the public and unbuyable.
describe("Publish status gates public visibility", () => {
  it("GET /courses lists only published courses", async () => {
    const { course: published } = await seedCourse();
    await seedCourse({ status: "draft" });
    await seedCourse({ status: "hidden" });
    await seedCourse({ status: "archived" });

    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(200);
    const ids = res.body.map((c: { id: number }) => c.id);
    expect(ids).toEqual([published.id]);
  });

  it("GET /courses/:slug returns 404 for a non-published course", async () => {
    const { course } = await seedCourse({ status: "draft" });
    const res = await request(app).get(`/api/courses/${course.slug}`);
    expect(res.status).toBe(404);
  });

  it.each(["draft", "hidden", "archived"] as const)(
    "POST /payments/create returns 404 for a %s course",
    async (status) => {
      const { token } = await createUser();
      const { course } = await seedCourse({ status });
      const res = await request(app)
        .post("/api/payments/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ courseId: course.id });
      expect(res.status).toBe(404);
    },
  );

  it("hiding a published course removes it from the public listing", async () => {
    const { token: adminToken } = await createAdmin();
    const { course } = await seedCourse();

    const before = await request(app).get("/api/courses");
    expect(before.body.map((c: { id: number }) => c.id)).toContain(course.id);

    const patch = await request(app)
      .patch(`/api/admin/courses/${course.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "hidden" });
    expect(patch.status).toBe(200);

    const after = await request(app).get("/api/courses");
    expect(after.body.map((c: { id: number }) => c.id)).not.toContain(course.id);
  });
});

// Every CMS mutation lives behind requireAuth + requireAdmin. A representative
// endpoint from each module is checked for both the unauthenticated (401) and
// authenticated-non-admin (403) cases.
describe("CMS admin authorization", () => {
  const endpoints: Array<{
    name: string;
    method: "get" | "put" | "post" | "patch";
    path: string;
  }> = [
    { name: "list landing", method: "get", path: "/api/admin/landing" },
    { name: "update pricing", method: "put", path: "/api/admin/pricing" },
    { name: "update seo", method: "put", path: "/api/admin/seo" },
    { name: "create faq", method: "post", path: "/api/admin/faq" },
  ];

  it.each(endpoints)("blocks unauthenticated access to $name (401)", async (ep) => {
    const res = await request(app)[ep.method](ep.path).send({});
    expect(res.status).toBe(401);
  });

  it.each(endpoints)("blocks non-admins from $name (403)", async (ep) => {
    const { token } = await createUser();
    const res = await request(app)
      [ep.method](ep.path)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it("blocks non-admins from changing course status (403)", async () => {
    const { token } = await createUser();
    const { course } = await seedCourse();
    const res = await request(app)
      .patch(`/api/admin/courses/${course.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "draft" });
    expect(res.status).toBe(403);
  });
});

// The public content endpoints expose only enabled/visible rows; the admin
// editor sees everything.
describe("Public content endpoints", () => {
  it("GET /content/seo always returns usable defaults", async () => {
    const res = await request(app).get("/api/content/seo");
    expect(res.status).toBe(200);
    expect(typeof res.body.metaTitle).toBe("string");
    expect(res.body.robots).toBeTruthy();
  });

  it("GET /content/faq returns only visible items", async () => {
    const { token } = await createAdmin();
    const created = await request(app)
      .post("/api/admin/faq")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Pytanie ukryte?", answer: "Odpowiedź", isVisible: false });
    expect(created.status).toBe(201);

    const visible = await request(app)
      .post("/api/admin/faq")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Pytanie widoczne?", answer: "Odpowiedź", isVisible: true });
    expect(visible.status).toBe(201);

    const res = await request(app).get("/api/content/faq");
    expect(res.status).toBe(200);
    const questions = res.body.map((f: { question: string }) => f.question);
    expect(questions).toContain("Pytanie widoczne?");
    expect(questions).not.toContain("Pytanie ukryte?");
  });
});

// GET /courses/:slug filters the whole tree by status, but content is also
// reachable directly by id. A draft/hidden/archived entity — or anything under a
// non-published parent — must stay invisible on those direct routes too, even to
// a user who has paid for the course.
describe("Publish status cascade on direct content access", () => {
  it("GET /quizzes/:id returns 404 for a draft quiz", async () => {
    const { user, token } = await createUser();
    const { course, quiz } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(quizzes).set({ status: "draft" }).where(eq(quizzes.id, quiz.id));
    const res = await request(app)
      .get(`/api/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("POST /quizzes/:id/attempts returns 404 for a hidden quiz", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(quizzes).set({ status: "hidden" }).where(eq(quizzes.id, quiz.id));
    const answers = questions.map((q) => ({
      questionId: q.id,
      selectedAnswerId: q.correctAnswerId,
    }));
    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answers });
    expect(res.status).toBe(404);
  });

  it("GET /topics/:id returns 404 when the owning section is hidden", async () => {
    const { user, token } = await createUser();
    const { course, section, topic } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(sections).set({ status: "hidden" }).where(eq(sections.id, section.id));
    const res = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("GET /topics/:id returns 404 when the owning course is archived", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db
      .update(courses)
      .set({ status: "archived", isPublished: false })
      .where(eq(courses.id, course.id));
    const res = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("GET /sections/:id/topics returns an empty outline for a hidden section", async () => {
    const { user, token } = await createUser();
    const { course, section } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(sections).set({ status: "hidden" }).where(eq(sections.id, section.id));
    const res = await request(app)
      .get(`/api/sections/${section.id}/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /sections/:id/topics reports hasQuiz=false for a hidden quiz", async () => {
    const { user, token } = await createUser();
    const { course, section, topic, quiz } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(quizzes).set({ status: "hidden" }).where(eq(quizzes.id, quiz.id));
    const res = await request(app)
      .get(`/api/sections/${section.id}/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const t = res.body.find((x: { id: number }) => x.id === topic.id);
    expect(t).toBeDefined();
    expect(t.hasQuiz).toBe(false);
  });

  it("POST /ai/lesson-chat returns 404 for a hidden topic even with access", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(topics).set({ status: "hidden" }).where(eq(topics.id, topic.id));
    const res = await request(app)
      .post(`/api/ai/lesson-chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, message: "Wyjaśnij siłę grawitacji" });
    expect(res.status).toBe(404);
  });

  it("POST /ai/check returns 404 for a task under a hidden topic", async () => {
    const { user, token } = await createUser();
    const { course, topic, task } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(topics).set({ status: "hidden" }).where(eq(topics.id, topic.id));
    const res = await request(app)
      .post(`/api/ai/check`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        taskId: task.id,
        imageBase64:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      });
    expect(res.status).toBe(404);
  });

  it("POST /progress returns 404 for a hidden topic", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(topics).set({ status: "hidden" }).where(eq(topics.id, topic.id));
    const res = await request(app)
      .post(`/api/progress`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, currentElementType: "video" });
    expect(res.status).toBe(404);
  });

  it("POST /progress/video returns 404 for a video under a hidden topic", async () => {
    const { user, token } = await createUser();
    const { course, topic, video } = await seedCourse();
    await grantAccess(user.id, course.id);
    await db.update(topics).set({ status: "hidden" }).where(eq(topics.id, topic.id));
    const res = await request(app)
      .post(`/api/progress/video`)
      .set("Authorization", `Bearer ${token}`)
      .send({ videoId: video.id, watchedSeconds: 10 });
    expect(res.status).toBe(404);
  });

  it("GET /progress/continue skips a topic that was later hidden", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    await grantAccess(user.id, course.id);
    await request(app)
      .post(`/api/progress`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, currentElementType: "video" });
    await db.update(topics).set({ status: "hidden" }).where(eq(topics.id, topic.id));
    const res = await request(app)
      .get(`/api/progress/continue`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.topicId).toBeNull();
  });
});
