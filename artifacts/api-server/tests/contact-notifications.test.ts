import { describe, it, expect } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, contactMessages } from "@workspace/db";
import app from "../src/app";
import { createUser, createAdmin } from "./helpers/factories";

const validBody = {
  name: "Test Uczeń",
  email: "uczen@example.com",
  subject: "Pytanie o kurs",
  message: "To jest testowa wiadomość kontaktowa.",
  consent: true,
};

describe("POST /contact — email delivery status", () => {
  it("saves the message and records emailStatus 'skipped' when SMTP is not configured", async () => {
    const res = await request(app).post("/api/contact").send(validBody);
    expect(res.status).toBe(201);

    const [saved] = await db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.email, validBody.email));
    expect(saved).toBeDefined();
    expect(saved.status).toBe("new");
    expect(saved.emailStatus).toBe("skipped");
  });
});

describe("GET /admin/contact-messages/new-count", () => {
  it("requires authentication (401)", async () => {
    const res = await request(app).get("/api/admin/contact-messages/new-count");
    expect(res.status).toBe(401);
  });

  it("blocks non-admins (403)", async () => {
    const { token } = await createUser();
    const res = await request(app)
      .get("/api/admin/contact-messages/new-count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns the count of messages with status 'new' only", async () => {
    const { token } = await createAdmin();
    await db.insert(contactMessages).values([
      { ...validBody, status: "new", consentAt: new Date() },
      { ...validBody, status: "new", consentAt: new Date() },
      { ...validBody, status: "read", consentAt: new Date() },
      { ...validBody, status: "closed", consentAt: new Date() },
    ]);

    const res = await request(app)
      .get("/api/admin/contact-messages/new-count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

describe("GET /admin/contact-messages — includes emailStatus", () => {
  it("exposes emailStatus so the admin can see failed notifications", async () => {
    const { token } = await createAdmin();
    await db.insert(contactMessages).values({
      ...validBody,
      status: "new",
      emailStatus: "failed",
      consentAt: new Date(),
    });

    const res = await request(app)
      .get("/api/admin/contact-messages")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const failed = res.body.messages.find(
      (m: { emailStatus?: string }) => m.emailStatus === "failed",
    );
    expect(failed).toBeDefined();
  });
});
