import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { prisma } from "../src/lib/prisma.js";
import { createUser, createCourse, authHeader } from "./helpers.js";

// LGPD: consentimento no cadastro e direito de eliminação (art. 18, VI).
describe("LGPD", () => {
  it("cadastro exige aceite dos termos e registra o timestamp", async () => {
    const refused = await request(app).post("/api/auth/signup").send({
      name: "No",
      email: "no@t.com",
      password: "senha12345",
      termsAccepted: false,
    });
    expect(refused.status).toBe(400);

    const ok = await request(app).post("/api/auth/signup").send({
      name: "Yes",
      email: "yes@t.com",
      password: "senha12345",
      termsAccepted: true,
    });
    expect(ok.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "yes@t.com" } });
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it("DELETE /api/users/me anonimiza e revoga acessos", async () => {
    const { user, token } = await createUser({ name: "Sair", email: "sair@t.com", password: "senha12345" });
    const { user: instructor } = await createUser({ name: "P", email: "plgpd@t.com", role: "INSTRUCTOR" });
    const course = await createCourse(instructor.id);
    await prisma.enrollment.create({ data: { userId: user.id, courseId: course.id, status: "ACTIVE" } });

    const res = await request(app).delete("/api/users/me").set(authHeader(token));
    expect(res.status).toBe(200);

    const anon = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(anon.name).toBe("Usuário excluído");
    expect(anon.email).toContain("@deleted.local");
    expect(anon.passwordHash).toBeNull();

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });
    expect(enrollment.status).toBe("CANCELED");

    // Conta anonimizada não loga mais
    const login = await request(app).post("/api/auth/login").send({ email: "sair@t.com", password: "senha12345" });
    expect(login.status).toBe(401);
  });

  it("GET /api/users/me retorna os dados da conta", async () => {
    const { token } = await createUser({ name: "Eu", email: "eu@t.com" });
    const res = await request(app).get("/api/users/me").set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("eu@t.com");
    expect(res.body).not.toHaveProperty("passwordHash");
  });
});
