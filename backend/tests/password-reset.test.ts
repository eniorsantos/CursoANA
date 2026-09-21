import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { prisma } from "../src/lib/prisma.js";
import { createUser } from "./helpers.js";

// Fluxo de reset de senha (spec painel-admin §2.4 + testes-e-cicd §1.3):
// token válido de uso único com expiração curta.
describe("resetPassword", () => {
  it("redefine a senha com token válido e invalida o token", async () => {
    const { user } = await createUser({ name: "T", email: "t@test.com", password: "antiga12345" });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: "token-valido", expiresAt: new Date(Date.now() + 60_000) },
    });

    const res = await request(app)
      .post("/api/auth/redefinir-senha")
      .send({ token: "token-valido", newPassword: "novaSenha123" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // A nova senha funciona no login (prova que o hash foi trocado)
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "t@test.com", password: "novaSenha123" });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });

  it("rejeita reutilização do mesmo token", async () => {
    const { user } = await createUser({ name: "T2", email: "t2@test.com" });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: "token-reuso", expiresAt: new Date(Date.now() + 60_000) },
    });

    await request(app).post("/api/auth/redefinir-senha").send({ token: "token-reuso", newPassword: "senhaNova11" });
    const reuse = await request(app)
      .post("/api/auth/redefinir-senha")
      .send({ token: "token-reuso", newPassword: "outraSenha22" });

    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toMatch("inválido ou expirado");
  });

  it("rejeita token expirado", async () => {
    const { user } = await createUser({ name: "T3", email: "t3@test.com" });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: "token-expirado", expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post("/api/auth/redefinir-senha")
      .send({ token: "token-expirado", newPassword: "novaSenha123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch("inválido ou expirado");
  });
});
