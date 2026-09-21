import { Worker } from "bullmq";
import { connection } from "../lib/queues-bullmq.js";
import { prisma } from "../lib/prisma.js";
import { issueCertificateIfEligible } from "../lib/certificates.js";
import { sendPushToUser } from "../lib/push.js";

export const emailWorker = new Worker(
  "email",
  async (job) => {
    if (job.name === "welcome-email" || job.name === "payment-failed-email" || job.name === "password-reset-email") {
      console.log(`[email] enviando ${job.name}`, job.data);
      // Integração real: Resend. Aqui apenas log (trocar RESEND_API_KEY em prod).
    }
  },
  { connection, concurrency: 10 }
);

emailWorker.on("failed", async (job, err) => {
  console.error(`Email job ${job?.id} falhou:`, err.message);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.failedJob.create({
      data: { queueName: "email", jobName: job.name, payload: JSON.stringify(job.data), error: err.message },
    });
  }
});

export const certificateWorker = new Worker(
  "certificate",
  async (job) => {
    const { userId, courseId } = job.data as { userId: string; courseId: string };
    const certificate = await issueCertificateIfEligible(userId, courseId);
    if (certificate) {
      const { queues } = await import("../lib/queue.js");
      await queues.add("email", "certificate-issued-email", { userId, courseId });
    }
  },
  { connection, concurrency: 3 }
);

export const videoWorker = new Worker(
  "video-processing",
  async (job) => {
    const event = job.data as { type?: string; data?: { playback_ids?: { id: string }[]; upload_id?: string; id?: string } };
    if (event.type === "video.asset.ready") {
      const playbackId = event.data?.playback_ids?.[0]?.id;
      if (playbackId && event.data?.upload_id) {
        await prisma.lesson.updateMany({ where: { videoAssetId: event.data.upload_id }, data: { videoAssetId: playbackId } });
      }
    }
    if (event.type === "video.asset.errored") {
      console.error("Falha no processamento de vídeo:", event.data?.id);
    }
  },
  { connection, concurrency: 5 }
);

export const pushWorker = new Worker(
  "push",
  async (job) => {
    const { userId, title, body, data } = job.data as {
      userId: string;
      title: string;
      body: string;
      data: Record<string, string>;
    };
    await sendPushToUser(userId, title, body, data);
  },
  { connection, concurrency: 10 }
);

pushWorker.on("failed", async (job, err) => {
  console.error(`Push job ${job?.id} falhou:`, err.message);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.failedJob.create({
      data: { queueName: "push", jobName: job.name, payload: JSON.stringify(job.data), error: err.message },
    });
  }
});
