// Filas BullMQ com fallback em memória (quando REDIS_URL não está configurado,
// ex: dev local sem Redis). API idêntica para produtores.
type Job = { name: string; data: unknown; opts?: Record<string, unknown> };

const memoryJobs: Job[] = [];

async function add(queue: string, name: string, data: unknown, opts?: Record<string, unknown>) {
  if (!process.env.REDIS_URL) {
    memoryJobs.push({ name: `${queue}:${name}`, data, opts });
    console.log(`[queue:${queue}] job enfileirado (memória): ${name}`);
    return { id: `mem-${memoryJobs.length}` };
  }
  const { emailQueue, certificateQueue, videoQueue, pushQueue } = await import("./queues-bullmq.js");
  const q =
    queue === "email" ? emailQueue
    : queue === "certificate" ? certificateQueue
    : queue === "push" ? pushQueue
    : videoQueue;
  return q.add(name, data, opts);
}

export const queues = { add };

export async function queueWelcomeEmail(userId: string, courseId: string) {
  return add("email", "welcome-email", { userId, courseId }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
  });
}

export async function queueCertificateCheck(userId: string, courseId: string) {
  return add("certificate", "check-and-issue", { userId, courseId }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    jobId: `cert-${userId}-${courseId}`,
  });
}

export async function queueMuxEvent(event: unknown) {
  return add("video-processing", "mux-event", event, { attempts: 5 });
}

export async function queuePush(userId: string, title: string, body: string, data?: Record<string, string>) {
  return add("push", "send-push", { userId, title, body, data: data ?? {} }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
  });
}
