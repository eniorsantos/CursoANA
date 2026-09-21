import { prisma } from "../src/lib/prisma.js";

// Limpa as tabelas entre testes, mantendo o schema. Ordem com filhos primeiro
// (CASCADE garante, mas a ordem explícita evita surpresas).
export async function truncateAll() {
  const tables = [
    "failed_jobs",
    "password_reset_tokens",
    "lesson_progress",
    "certificates",
    "enrollments",
    "payments",
    "plan_courses",
    "subscriptions",
    "plans",
    "coupons",
    "lessons",
    "modules",
    "courses",
    "users",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }
}
