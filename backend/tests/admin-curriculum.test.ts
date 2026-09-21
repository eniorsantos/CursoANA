import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { prisma } from "../src/lib/prisma.js";
import { createUser, createCourse, authHeader } from "./helpers.js";

// Editor de currículo (spec painel-admin §1.4): CRUD de módulos/aulas com
// propriedade, reordenação transacional e leitura completa do curso.
describe("editor de currículo (admin)", () => {
  it("instrutor gerencia o próprio currículo; estranho recebe 403", async () => {
    const { user: owner, token: ownerToken } = await createUser({ name: "O", email: "o@t.com", role: "INSTRUCTOR" });
    const { token: strangerToken } = await createUser({ name: "S", email: "s2@t.com", role: "INSTRUCTOR" });
    const course = await createCourse(owner.id);

    // cria módulo
    const modRes = await request(app)
      .post(`/api/courses/${course.id}/modules`)
      .set(authHeader(ownerToken))
      .send({ title: "Módulo 1" });
    expect(modRes.status).toBe(201);

    // estranho tenta criar aula no módulo alheio
    const forbidden = await request(app)
      .post(`/api/courses/modules/${modRes.body.id}/lessons`)
      .set(authHeader(strangerToken))
      .send({ title: "Aula invasora" });
    expect(forbidden.status).toBe(403);

    // dono cria aula
    const lessonRes = await request(app)
      .post(`/api/courses/modules/${modRes.body.id}/lessons`)
      .set(authHeader(ownerToken))
      .send({ title: "Aula 1", type: "VIDEO" });
    expect(lessonRes.status).toBe(201);

    // leitura completa do curso
    const full = await request(app).get(`/api/admin/courses/${course.id}`).set(authHeader(ownerToken));
    expect(full.status).toBe(200);
    expect(full.body.modules).toHaveLength(1);
    expect(full.body.modules[0].lessons).toHaveLength(1);

    // estranho não lê
    const fullForbidden = await request(app).get(`/api/admin/courses/${course.id}`).set(authHeader(strangerToken));
    expect(fullForbidden.status).toBe(403);

    // renomeia módulo + marca preview + reordena aulas
    const patchMod = await request(app)
      .patch(`/api/admin/modules/${modRes.body.id}`)
      .set(authHeader(ownerToken))
      .send({ title: "Fundamentos" });
    expect(patchMod.body.title).toBe("Fundamentos");

    const patchLesson = await request(app)
      .patch(`/api/admin/lessons/${lessonRes.body.id}`)
      .set(authHeader(ownerToken))
      .send({ isFreePreview: true });
    expect(patchLesson.body.isFreePreview).toBe(true);

    const reorder = await request(app)
      .post(`/api/admin/modules/${modRes.body.id}/lessons/reorder`)
      .set(authHeader(ownerToken))
      .send({ orderedIds: [lessonRes.body.id] });
    expect(reorder.body.success).toBe(true);

    // deleta aula e módulo
    await request(app).delete(`/api/admin/lessons/${lessonRes.body.id}`).set(authHeader(ownerToken)).expect(200);
    await request(app).delete(`/api/admin/modules/${modRes.body.id}`).set(authHeader(ownerToken)).expect(200);
    expect(await prisma.lesson.count({ where: { module: { courseId: course.id } } })).toBe(0);
  });
});
