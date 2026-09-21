import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const emailQueue = new Queue("email", { connection });
export const certificateQueue = new Queue("certificate", { connection });
export const videoQueue = new Queue("video-processing", { connection });
