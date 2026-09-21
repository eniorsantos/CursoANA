import { Router } from "express";
import { z } from "zod";
import slugify from "../lib/slugify.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, assertOwnsCourse } from "../middleware/auth.js";

const router = Router();

const courseSchema = z.object({
  title: z.string().min(3, "Título muito curto"),
  description: z.string().min(10, "Descreva melhor o curso"),
  priceCents: z.coerce.number().int().min(0),
});

// GET /api/courses — catálogo público (apenas PUBLISHED), com busca ?q=
router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
  const courses = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    include: { instructor: { select: { name: true } }, _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(courses);
});

// GET /api/courses/suggest?q= — autocomplete leve para a busca mobile (top 5).
// Declarada ANTES de /:slug para não ser capturada como slug.
router.get("/suggest", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) return res.json([]);
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED", title: { contains: q, mode: "insensitive" } },
    select: { id: true, slug: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  res.json(courses);
});

// GET /api/courses/:slug
router.get("/:slug", async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { slug: req.params.slug },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  if (!course) return res.status(404).json({ error: "Curso não encontrado" });
  res.json(course);
});

// GET /api/courses/:id/access
router.get("/:id/access", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const { hasAccessToCourse } = await import("../lib/access.js");
  const hasAccess = await hasAccessToCourse(user.id, req.params.id);
  res.json({ hasAccess });
});

// POST /api/courses — ADMIN/INSTRUCTOR
router.post("/", requireAuth, requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const parsed = courseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  const course = await prisma.course.create({
    data: {
      ...parsed.data,
      slug: slugify(parsed.data.title),
      instructorId: user.id,
      status: "DRAFT",
    },
  });
  res.status(201).json(course);
});

// PATCH /api/courses/:id
router.patch("/:id", requireAuth, requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const course = await prisma.course.findUniqueOrThrow({ where: { id: req.params.id } });
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  const parsed = courseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  const updated = await prisma.course.update({ where: { id: course.id }, data: parsed.data });
  res.json(updated);
});

// POST /api/courses/:id/publish
router.post("/:id/publish", requireAuth, requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const course = await prisma.course.findUniqueOrThrow({ where: { id: req.params.id } });
  try {
    await assertOwnsCourse(user, course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  const moduleCount = await prisma.module.count({ where: { courseId: course.id } });
  if (moduleCount === 0) return res.status(400).json({ error: "Adicione ao menos um módulo antes de publicar" });
  const updated = await prisma.course.update({ where: { id: course.id }, data: { status: "PUBLISHED" } });
  res.json(updated);
});

// DELETE /api/courses/:id — só ADMIN
router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  await prisma.course.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// POST /api/courses/:id/modules
router.post("/:id/modules", requireAuth, requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const course = await prisma.course.findUniqueOrThrow({ where: { id: req.params.id } });
  await assertOwnsCourse(user, course.instructorId);
  const last = await prisma.module.findFirst({ where: { courseId: course.id }, orderBy: { order: "desc" } });
  const module = await prisma.module.create({
    data: { courseId: course.id, title: req.body.title ?? "Novo módulo", order: (last?.order ?? 0) + 1 },
  });
  res.status(201).json(module);
});

// POST /api/courses/modules/reorder — transação atômica
router.post("/:id/modules/reorder", requireAuth, requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const course = await prisma.course.findUniqueOrThrow({ where: { id: req.params.id } });
  await assertOwnsCourse(user, course.instructorId);
  const orderedIds: string[] = req.body.orderedIds ?? [];
  await prisma.$transaction(orderedIds.map((id, index) => prisma.module.update({ where: { id }, data: { order: index } })));
  res.json({ success: true });
});

// POST /api/courses/modules/:moduleId/lessons
router.post("/modules/:moduleId/lessons", requireAuth, requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const module = await prisma.module.findUniqueOrThrow({
    where: { id: req.params.moduleId },
    include: { course: true },
  });
  try {
    await assertOwnsCourse(user, module.course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }
  const last = await prisma.lesson.findFirst({ where: { moduleId: module.id }, orderBy: { order: "desc" } });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: module.id,
      title: req.body.title ?? "Nova aula",
      type: req.body.type ?? "VIDEO",
      order: (last?.order ?? 0) + 1,
    },
  });
  res.status(201).json(lesson);
});

export default router;
