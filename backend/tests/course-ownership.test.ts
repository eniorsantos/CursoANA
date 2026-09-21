import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { prisma } from "../src/lib/prisma.js";
import { createUser, createCourse, authHeader } from "./helpers.js";

// Autorização de propriedade de curso (spec painel-admin §1.3 + testes-e-cicd §1.3):
// instrutor só edita o próprio curso; delete é exclusivo do ADMIN.
describe("proteção de propriedade de curso", () => {
  it("instrutor não edita curso de outro instrutor", async () => {
    const { user: instructorA } = await createUser({ name: "A", email: "a@test.com", role: "INSTRUCTOR" });
    const { token: tokenB } = await createUser({ name: "B", email: "b@test.com", role: "INSTRUCTOR" });
    const course = await createCourse(instructorA.id, { title: "Curso do A" });

    const res = await request(app)
      .patch(`/api/courses/${course.id}`)
      .set(authHeader(tokenB))
      .send({ title: "Tentando editar", description: "descrição qualquer com mais de 10 caracteres", priceCents: 2000 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch("permissão");

    const unchanged = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(unchanged.title).toBe("Curso do A");
  });

  it("instrutor edita o próprio curso", async () => {
    const { user, token } = await createUser({ name: "C", email: "c@test.com", role: "INSTRUCTOR" });
    const course = await createCourse(user.id, { title: "Curso do C" });

    const res = await request(app)
      .patch(`/api/courses/${course.id}`)
      .set(authHeader(token))
      .send({ title: "Novo título", description: "descrição qualquer com mais de 10 caracteres", priceCents: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Novo título");
  });

  it("instrutor não deleta curso (só ADMIN)", async () => {
    const { user, token } = await createUser({ name: "D", email: "d@test.com", role: "INSTRUCTOR" });
    const course = await createCourse(user.id);

    const res = await request(app).delete(`/api/courses/${course.id}`).set(authHeader(token));
    expect(res.status).toBe(403);
  });
});
