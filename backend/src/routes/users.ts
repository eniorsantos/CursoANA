import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/users/me — dados da conta
router.get("/me", async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, termsAcceptedAt: true, createdAt: true },
  });
  res.json(me);
});

// POST /api/users/me/push-tokens — registra o Expo push token do device
router.post("/me/push-tokens", async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const { token, platform } = req.body ?? {};
  if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
    return res.status(400).json({ error: "Push token inválido" });
  }
  const saved = await prisma.pushToken.upsert({
    where: { token },
    create: { userId: user.id, token, platform: platform ?? "unknown" },
    update: { userId: user.id },
  });
  res.status(201).json(saved);
});

// DELETE /api/users/me — direito de eliminação (LGPD art. 18, VI).
// Anonimiza a conta e revoga acessos; mantém registros fiscais (pagamentos)
// sem dados pessoais identificáveis além do necessário.
router.delete("/me", async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;

  await prisma.$transaction([
    // Apaga dados comportamentais e de recuperação
    prisma.lessonProgress.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    // Revoga acessos
    prisma.enrollment.updateMany({ where: { userId: user.id }, data: { status: "CANCELED" } }),
    prisma.subscription.updateMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { status: "CANCELED", canceledAt: new Date() },
    }),
    // Anonimiza a conta (email liberado para reuso futuro fica impossível de reverter)
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: "Usuário excluído",
        email: `deleted_${user.id}@deleted.local`,
        passwordHash: null,
        avatarUrl: null,
      },
    }),
  ]);

  res.json({ success: true });
});

export default router;
