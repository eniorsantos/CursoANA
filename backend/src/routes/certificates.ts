import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/certificates/verificar/:hash — pública (dá credibilidade ao certificado)
router.get("/verificar/:hash", async (req, res) => {
  const certificate = await prisma.certificate.findUnique({
    where: { verificationHash: req.params.hash },
    include: { user: { select: { name: true } }, course: { select: { title: true } } },
  });
  if (!certificate) return res.status(404).json({ valid: false, error: "Certificado não encontrado" });
  res.json({ valid: true, certificate });
});

// GET /api/users/me/certificates
router.get("/me", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const certs = await prisma.certificate.findMany({ where: { userId: user.id }, include: { course: true } });
  res.json(certs);
});

export default router;
