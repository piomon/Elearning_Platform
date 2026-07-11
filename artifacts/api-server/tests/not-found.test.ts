import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser } from "./helpers/factories";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Unknown API routes — 404 (admin router must not swallow them)", () => {
  it("returns 404 (not 401) for an unknown /api/* route without auth", async () => {
    const res = await request(app).get("/api/nie-istnieje");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Nie znaleziono" });
  });

  it("returns 404 for an unknown /api/* route with auth", async () => {
    const { token } = await createUser();
    const res = await request(app).get("/api/nie-istnieje").set(auth(token));
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown method on a known collection", async () => {
    const res = await request(app).delete("/api/courses");
    expect(res.status).toBe(404);
  });

  it("still protects /api/admin/* with 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/admin/dashboard");
    expect(res.status).toBe(401);
  });

  it("still returns 403 on /api/admin/* for a non-admin user", async () => {
    const { token } = await createUser();
    const res = await request(app).get("/api/admin/dashboard").set(auth(token));
    expect(res.status).toBe(403);
  });
});
