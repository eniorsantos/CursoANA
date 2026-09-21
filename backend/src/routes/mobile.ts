import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/mobile/home — agregado (hero + carrosséis numa única chamada)
router.get("/home", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;

  const enrolled = await prisma.enrollment.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { course: true },
    take: 10,
  });
  const recommended = await prisma.course.findMany({ where: { status: "PUBLISHED" }, take: 10 });

  const continueWatching = enrolled.map((e) => ({ ...e.course, progressPercent: 35 }));

  res.json({
    hero: recommended[0] ?? null,
    sections: [
      { title: "Continue assistindo", courses: continueWatching },
      { title: "Recomendados para você", courses: recommended },
      { title: "Meus cursos", courses: enrolled.map((e) => e.course) },
    ],
  });
});

export default router;
