import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma.js";
import { generateCertificatePdf } from "./generate-certificate-pdf.js";

const STORAGE_DIR = path.resolve("storage", "certificates");

function backendBaseUrl() {
  return process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
}

export async function issueCertificateIfEligible(userId: string, courseId: string) {
  const totalLessons = await prisma.lesson.count({ where: { module: { courseId } } });
  if (totalLessons === 0) return null;
  const completedLessons = await prisma.lessonProgress.count({
    where: { userId, completed: true, lesson: { module: { courseId } } },
  });
  if (completedLessons < totalLessons) return null;

  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  const verificationHash = crypto.randomBytes(16).toString("hex");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  const issuedAt = new Date();

  const pdf = await generateCertificatePdf({
    studentName: user.name,
    courseTitle: course.title,
    issuedAt,
    verificationHash,
  });

  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(path.join(STORAGE_DIR, `${verificationHash}.pdf`), pdf);

  // PDF com link direto (comprovante); a autenticidade se valida na página pública.
  const certificateUrl = `${backendBaseUrl()}/files/certificates/${verificationHash}.pdf`;

  return prisma.certificate.create({
    data: { userId, courseId, certificateUrl, verificationHash },
  });
}
