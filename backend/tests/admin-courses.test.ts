import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { createUser, createCourse, authHeader } from "./helpers.js";

describe("GET /api/admin/courses", () => {
  it("admin vê todos os cursos; instrutor vê só os seus", async () => {
    const { token: adminToken } = await createUser({ name: "Admin", email: "admin@t.com", role: "ADMIN" });
    const { user: instructorA, token: tokenA } = await createUser({ name: "A", email: "aa@t.com", role: "INSTRUCTOR" });
    const { user: instructorB } = await createUser({ name: "B", email: "bb@t.com", role: "INSTRUCTOR" });
    await createCourse(instructorA.id, { title: "Curso A1" });
    await createCourse(instructorB.id, { title: "Curso B1" });

    const adminRes = await request(app).get("/api/admin/courses").set(authHeader(adminToken));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body).toHaveLength(2);

    const instructorRes = await request(app).get("/api/admin/courses").set(authHeader(tokenA));
    expect(instructorRes.status).toBe(200);
    expect(instructorRes.body).toHaveLength(1);
    expect(instructorRes.body[0].title).toBe("Curso A1");
    expect(instructorRes.body[0]._count).toBeDefined();
  });

  it("aluno recebe 403", async () => {
    const { token } = await createUser({ name: "S", email: "s@t.com" });
    const res = await request(app).get("/api/admin/courses").set(authHeader(token));
    expect(res.status).toBe(403);
  });
});
