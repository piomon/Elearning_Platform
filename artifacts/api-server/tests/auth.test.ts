import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, seedCourse, grantAccess } from "./helpers/factories";

describe("auth", () => {
  it("registers a new user and returns a token without the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "Nowy@Test.pl",
      password: "haslo123",
      firstName: "Anna",
      lastName: "Kowalska",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("nowy@test.pl");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a password shorter than 6 characters", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "krotkie@test.pl",
      password: "123",
      firstName: "A",
      lastName: "B",
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "x@test.pl" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    const { user } = await createUser({ email: "dup@test.pl" });
    const res = await request(app).post("/api/auth/register").send({
      email: user.email,
      password: "haslo123",
      firstName: "A",
      lastName: "B",
    });
    expect(res.status).toBe(409);
  });

  it("logs in with valid credentials", async () => {
    const { user, password } = await createUser({ email: "log@test.pl" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a wrong password with 401", async () => {
    const { user } = await createUser({ email: "wrong@test.pl" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "zlehaslo" });
    expect(res.status).toBe(401);
  });

  it("blocks a banned user from logging in with 403", async () => {
    const { user, password } = await createUser({
      email: "ban@test.pl",
      isBanned: true,
      bannedReason: "spam",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password });
    expect(res.status).toBe(403);
  });

  it("requires a token for /auth/me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
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
});
