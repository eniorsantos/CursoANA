import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import { prisma } from "../src/lib/prisma.js";
import { issueCertificateIfEligible } from "../src/lib/certificates.js";
import { createUser, createCourse } from "./helpers.js";

describe("issueCertificateIfEligible", () => {
  it("emite certificado com PDF real ao concluir todas as aulas", async () => {
    const { user } = await createUser({ name: "Aluna", email: "aluna@test.com" });
    const { user: instructor } = await createUser({ name: "Prof", email: "profc@test.com", role: "INSTRUCTOR" });
    const course = await createCourse(instructor.id);
    const module = await prisma.module.create({ data: { courseId: course.id, title: "M1", order: 0 } });
    const lesson = await prisma.lesson.create({
      data: { moduleId: module.id, title: "Aula 1", type: "VIDEO", order: 0, durationSecs: 100 },
    });
    await prisma.lessonProgress.create({
      data: { userId: user.id, lessonId: lesson.id, watchedSeconds: 95, completed: true, completedAt: new Date() },
    });

    const cert = await issueCertificateIfEligible(user.id, course.id);

    expect(cert?.verificationHash).toHaveLength(32);
    expect(cert?.certificateUrl).toContain(".pdf");

    // O PDF foi gravado em storage/ e começa com o magic number %PDF
    const localPath = `storage/certificates/${cert!.verificationHash}.pdf`;
    const bytes = await fs.readFile(localPath);
    expect(Buffer.from(bytes.subarray(0, 4)).toString()).toBe("%PDF");
    await fs.rm(localPath); // limpa o artefato do teste
  });

  it("não emite antes de concluir todas as aulas", async () => {
    const { user } = await createUser({ name: "AlunoX", email: "alunox@test.com" });
    const { user: instructor } = await createUser({ name: "ProfX", email: "profx@test.com", role: "INSTRUCTOR" });
    const course = await createCourse(instructor.id);
    const module = await prisma.module.create({ data: { courseId: course.id, title: "M1", order: 0 } });
    await prisma.lesson.create({ data: { moduleId: module.id, title: "Aula 1", type: "VIDEO", order: 0 } });

    const cert = await issueCertificateIfEligible(user.id, course.id);
    expect(cert).toBeNull();
  });
});
