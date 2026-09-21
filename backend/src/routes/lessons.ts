import { Router } from "express";
import Mux from "@mux/mux-node";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, assertOwnsCourse } from "../middleware/auth.js";
import { hasAccessToCourse } from "../lib/access.js";
import { getSignedPlaybackUrl } from "../lib/video.js";
import { queueCertificateCheck } from "../lib/queue.js";

const router = Router();

// GET /api/lessons/:id/playback-url — verifica acesso ANTES de gerar URL assinada
router.get("/:id/playback-url", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { module: { include: { course: true } } },
  });
  const access = await hasAccessToCourse(user.id, lesson.module.course.id);
  if (!access && !lesson.isFreePreview) {
    return res.status(403).json({ error: "Sem acesso a esta aula" });
  }
  if (!lesson.videoAssetId) return res.status(404).json({ error: "Vídeo ainda não processado" });
  const url = getSignedPlaybackUrl(lesson.videoAssetId);
  res.json({ url });
});

// POST /api/lessons/:id/progress — upsert + enfileira checagem de certificado
router.post("/:id/progress", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string } }).user;
  const { watchedSeconds } = req.body ?? {};
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: req.params.id }, include: { module: true } });
  const completed = lesson.durationSecs ? Number(watchedSeconds) / lesson.durationSecs >= 0.9 : false;
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    create: { userId: user.id, lessonId: lesson.id, watchedSeconds: Number(watchedSeconds) || 0, completed },
    update: { watchedSeconds: Number(watchedSeconds) || 0, completed, completedAt: completed ? new Date() : undefined },
  });
  if (completed) await queueCertificateCheck(user.id, lesson.module.courseId);
  res.json({ ok: true, completed });
});

// POST /api/lessons/admin/:id/upload — cria upload direto (Mux). O instrutor envia
// o arquivo direto ao Mux sem passar pelo servidor (evita sobrecarregar a API).
router.post("/admin/:id/upload", requireAuth, requireRole(["ADMIN", "INSTRUCTOR"]), async (req, res) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user;
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { module: { include: { course: true } } },
  });
  try {
    await assertOwnsCourse(user, lesson.module.course.instructorId);
  } catch (e) {
    return res.status(403).json({ error: (e as Error).message });
  }

  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    return res.json({ uploadUrl: "https://mux-mock/upload-url", mocked: true });
  }

  const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
  });
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.APP_URL ?? "http://localhost:3000",
    new_asset_settings: { playback_policy: ["signed"] },
  });

  // Guarda o upload_id temporariamente; o webhook video.asset.ready troca pelo playback_id.
  await prisma.lesson.update({ where: { id: lesson.id }, data: { videoAssetId: upload.id } });

  return res.json({ uploadUrl: upload.url, uploadId: upload.id, mocked: false });
});

export default router;
