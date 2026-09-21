import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const plans = await prisma.plan.findMany();
  res.json(plans);
});

router.get("/me", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const subs = await prisma.subscription.findMany({ where: { userId: user.id }, include: { plan: true } });
  res.json(subs);
});

export default router;
