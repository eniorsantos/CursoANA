import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, assertOwnsCourse } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

type Actor = { id: string; role: string };

// Carrega o curso via módulo/aula e garante propriedade (instrutor só o seu).
async function courseOfModule(moduleId: string) {
  const module = await prisma.module.findUniqueOrThrow({
    where: { id: moduleId },
    include: { course: true },
  });
  return { module, course: module.course };
}

async function courseOfLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  return { lesson, course: lesson.module.course };
}

// GET /api/admin/dashboard — agrega Payment, Enrollment, Course
router.get("/dashboard", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const courseFilter = user.role === "ADMIN" ? {} : { instructorId: user.id };
  const courseIds = (await prisma.course.findMany({ where: courseFilter, select: { id: true } })).map((c) => c.id);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyPayments = await prisma.payment.findMany({
    where: { courseId: { in: courseIds }, status: "PAID", paidAt: { gte: startOfMonth } },
  });
  const monthlyRevenueCents = monthlyPayments.reduce((s, p) => s + p.amountCents, 0);
  const newStudents = await prisma.enrollment.count({
    where: { courseId: { in: courseIds }, enrolledAt: { gte: startOfMonth } },
  });
  const publishedCourses = await prisma.course.count({ where: { ...courseFilter, status: "PUBLISHED" } });

  // Receita por dia (últimos 30 dias) — para Recharts
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const paid = await prisma.payment.findMany({
    where: { courseId: { in: courseIds }, status: "PAID", paidAt: { gte: since } },
    select: { amountCents: true, paidAt: true },
  });
  const byDay = new Map<string, number>();
  for (const p of paid) {
    const day = (p.paidAt ?? new Date()).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + p.amountCents);
  }
  const revenueByDay = [...byDay.entries()].map(([date, revenueCents]) => ({ date, revenueCents })).sort((a, b) => a.date.localeCompare(b.date));

  const topCourses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    include: { _count: { select: { enrollments: true } } },
    orderBy: { enrollments: { _count: "desc" } },
    take: 5,
  });

  res.json({ monthlyRevenueCents, newStudents, publishedCourses, revenueByDay, topCourses, revenueTrend: 12, studentsTrend: 8 });
});

// GET /api/admin/enrollments
router.get("/enrollments", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const enrollments = await prisma.enrollment.findMany({
    include: { user: { select: { name: true, email: true } }, course: { select: { title: true } } },
    orderBy: { enrolledAt: "desc" },
    take: 50,
  });
  res.json(enrollments);
});

// GET /api/admin/courses — todos os cursos visíveis ao papel (instrutor: só os seus)
router.get("/courses", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const courses = await prisma.course.findMany({
    where: user.role === "ADMIN" ? {} : { instructorId: user.id },
    include: {
      _count: { select: { enrollments: true, modules: true } },
      instructor: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(courses);
});

// GET /api/admin/courses/:id — curso completo para o editor (módulos + aulas ordenados)
router.get("/courses/:id", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: Actor }).user;
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  if (!course) return res.status(404).json({ error: "Curso não encontrado" });
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  res.json(course);
});

// PATCH /api/admin/modules/:moduleId — renomear módulo
router.patch("/modules/:moduleId", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: Actor }).user;
  const { module, course } = await courseOfModule(req.params.moduleId);
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  const updated = await prisma.module.update({ where: { id: module.id }, data: { title: req.body.title } });
  res.json(updated);
});

// DELETE /api/admin/modules/:moduleId
router.delete("/modules/:moduleId", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: Actor }).user;
  const { module, course } = await courseOfModule(req.params.moduleId);
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  await prisma.module.delete({ where: { id: module.id } });
  res.json({ success: true });
});

// POST /api/admin/modules/:moduleId/lessons/reorder — transação atômica
router.post("/modules/:moduleId/lessons/reorder", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: Actor }).user;
  const { course } = await courseOfModule(req.params.moduleId);
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  const orderedIds: string[] = req.body.orderedIds ?? [];
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.lesson.update({ where: { id }, data: { order: index } }))
  );
  res.json({ success: true });
});

// GET /api/admin/lessons/:lessonId — aula para a tela de edição/upload
router.get("/lessons/:lessonId", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: Actor }).user;
  const { lesson, course } = await courseOfLesson(req.params.lessonId);
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  res.json({ ...lesson, courseId: course.id, courseTitle: course.title });
});

// PATCH /api/admin/lessons/:lessonId — título, preview gratuito, conteúdo
router.patch("/lessons/:lessonId", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: Actor }).user;
  const { lesson, course } = await courseOfLesson(req.params.lessonId);
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  const { title, isFreePreview, content, type } = req.body ?? {};
  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(isFreePreview !== undefined ? { isFreePreview: !!isFreePreview } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(type !== undefined ? { type } : {}),
    },
  });
  res.json(updated);
});

// DELETE /api/admin/lessons/:lessonId
router.delete("/lessons/:lessonId", requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: Actor }).user;
  const { lesson, course } = await courseOfLesson(req.params.lessonId);
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  await prisma.lesson.delete({ where: { id: lesson.id } });
  res.json({ success: true });
});

// GET /api/admin/finance
router.get("/finance", requireRole(["ADMIN"]), async (_req, res) => {
  const payments = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } }, course: { select: { title: true } } } });
  const totalRevenueCents = (await prisma.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAID" } }))._sum.amountCents ?? 0;
  const activeSubscriptions = await prisma.subscription.count({ where: { status: "ACTIVE" } });
  res.json({ totalRevenueCents, activeSubscriptions, mrrCents: activeSubscriptions * 2990, churnRate: 2.4, recentPayments: payments });
});

export default router;
