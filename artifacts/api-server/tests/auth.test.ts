import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, seedCourse, grantAccess } from "./helpers/factories";

// Sign-in/sign-up now happen entirely in Clerk on the client; the backend only
// verifies the Clerk session (mocked in tests/setup.ts, where the bearer token
// is the user's clerk_user_id) and exposes the synced profile via /auth/me.
describe("auth", () => {
  it("rejects /auth/me without a Clerk session (401)", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the synced profile and never leaks the password hash", async () => {
    const { user, token } = await createUser({ email: "Profil@Test.pl" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe("profil@test.pl");
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body.hasAccess).toBe(false);
    expect(res.body.accessGrants).toHaveLength(0);
  });

  it("blocks a banned user with 403", async () => {
    const { token } = await createUser({
      email: "ban@test.pl",
      isBanned: true,
      bannedReason: "spam",
    });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns hasAccess=false without a grant and true with one", async () => {
    const { user, token } = await createUser();
    const before = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body.hasAccess).toBe(false);

    const { course } = await seedCourse();
    await grantAccess(user.id, course.id);

    const after = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.hasAccess).toBe(true);
    expect(after.body.accessGrants).toHaveLength(1);
  });

  it("treats an admin as having access without an explicit grant", async () => {
    const { token } = await createUser({ role: "admin", email: "adm@test.pl" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
    expect(res.body.hasAccess).toBe(true);
  });
});
