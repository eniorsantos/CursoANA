import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken, validateCredentials } from "../lib/auth.js";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Mínimo de 8 caracteres"),
  termsAccepted: z.boolean().refine((v) => v === true, "É necessário aceitar os termos e a política de privacidade"),
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(400).json({ error: { email: ["Este email já está cadastrado"] } });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: "STUDENT", termsAcceptedAt: new Date() },
  });
  return res.status(201).json({ success: true, token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// POST /api/auth/login — também usado por /api/mobile/login (retorna JWT, mobile usa SecureStore)
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await validateCredentials(email, password);
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });
  return res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post("/mobile/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await validateCredentials(email, password);
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });
  const token = signToken(user);
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// POST /api/auth/recuperar-senha — resposta idêntica exista ou não o email (anti-enumeração)
router.post("/recuperar-senha", async (req, res) => {
  const { email } = req.body ?? {};
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 1000 * 60 * 30) },
    });
    const { queues } = await import("../lib/queue.js");
    await queues.add("email", "password-reset-email", { email: user.email, resetUrl: `${process.env.APP_URL}/redefinir-senha?token=${token}` });
  }
  return res.json({ success: true });
});

// POST /api/auth/redefinir-senha
router.post("/redefinir-senha", async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: "Dados inválidos" });
  }
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ error: "Link inválido ou expirado. Solicite um novo." });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);
  return res.json({ success: true });
});

// ---- Login social (Google, OAuth 2.0 Authorization Code) ----
// Requer no Google Cloud Console: client ID/secret com redirect autorizado em
// `${BACKEND_URL}/api/auth/google/callback`. Sem as envs, os endpoints respondem
// 501 e o frontend esconde o botão (NEXT_PUBLIC_GOOGLE_ENABLED).
function googleConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_URL, APP_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !BACKEND_URL || !APP_URL) return null;
  return { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_URL, APP_URL };
}

// GET /api/auth/google — redireciona ao consentimento do Google
router.get("/google", async (_req, res) => {
  const cfg = googleConfig();
  if (!cfg) return res.status(501).json({ error: "Login com Google não configurado" });
  const params = new URLSearchParams({
    client_id: cfg.GOOGLE_CLIENT_ID,
    redirect_uri: `${cfg.BACKEND_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback — troca o code por tokens, cria/acha o usuário e
// devolve ao frontend, que salva a sessão (mesmo JWT do login por senha).
router.get("/google/callback", async (req, res) => {
  const cfg = googleConfig();
  if (!cfg) return res.status(501).json({ error: "Login com Google não configurado" });
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.redirect(`${cfg.APP_URL}/login?error=google`);
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.GOOGLE_CLIENT_ID,
        client_secret: cfg.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${cfg.BACKEND_URL}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("Falha ao trocar code por tokens");
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error("Falha ao obter perfil do Google");
    const profile = (await meRes.json()) as { email: string; name: string; picture?: string };

    // Conta social não tem passwordHash (login só via Google) — como na spec §2.1.
    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { name: profile.name, email: profile.email, avatarUrl: profile.picture, role: "STUDENT" },
      });
    }
    const token = signToken(user);
    return res.redirect(`${cfg.APP_URL}/google/callback?token=${token}`);
  } catch {
    return res.redirect(`${cfg.APP_URL}/login?error=google`);
  }
});

export default router;
