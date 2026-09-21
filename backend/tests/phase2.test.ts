import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { prisma } from "../src/lib/prisma.js";
import { createUser, createCourse, authHeader } from "./helpers.js";

// Fase 2 mobile: push tokens, sugestões de busca e URL de download offline.
describe("fase 2 — push, suggest, download", () => {
  it("registra push token válido e rejeita inválido", async () => {
    const { token } = await createUser({ name: "M", email: "m@t.com" });

    const bad = await request(app)
      .post("/api/users/me/push-tokens")
      .set(authHeader(token))
      .send({ token: "não-é-um-token", platform: "android" });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post("/api/users/me/push-tokens")
      .set(authHeader(token))
      .send({ token: "ExponentPushToken[abc123]", platform: "android" });
    expect(ok.status).toBe(201);

    // Re-registro do mesmo device não duplica
    await request(app)
      .post("/api/users/me/push-tokens")
      .set(authHeader(token))
      .send({ token: "ExponentPushToken[abc123]", platform: "android" });
    expect(await prisma.pushToken.count()).toBe(1);
  });

  it("suggest retorna top 5 e exige ao menos 2 caracteres", async () => {
    const { user: instructor } = await createUser({ name: "P", email: "ps@t.com", role: "INSTRUCTOR" });
    await createCourse(instructor.id, { title: "React do Zero" });

    const short = await request(app).get("/api/courses/suggest?q=a");
    expect(short.body).toHaveLength(0);

    const res = await request(app).get("/api/courses/suggest?q=react");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("slug");
  });

  it("download-url exige acesso e video processado", async () => {
    const { user, token } = await createUser({ name: "A", email: "a2@t.com" });
    const { user: instructor } = await createUser({ name: "P2", email: "p2s@t.com", role: "INSTRUCTOR" });
    const course = await createCourse(instructor.id);
    const module = await prisma.module.create({ data: { courseId: course.id, title: "M", order: 0 } });
    const lesson = await prisma.lesson.create({
      data: { moduleId: module.id, title: "Aula", type: "VIDEO", order: 0, videoAssetId: "pb_test" },
    });

    // Sem acesso → 403
    const denied = await request(app).get(`/api/lessons/${lesson.id}/download-url`).set(authHeader(token));
    expect(denied.status).toBe(403);

    // Com matrícula → URL mp4 + expiração
    await prisma.enrollment.create({ data: { userId: user.id, courseId: course.id, status: "ACTIVE" } });
    const ok = await request(app).get(`/api/lessons/${lesson.id}/download-url`).set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.url).toContain(".mp4");
    expect(ok.body.expiresInDays).toBe(30);
  });
});
