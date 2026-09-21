import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";
import { signToken } from "../src/lib/auth.js";

export async function createUser(data: { name: string; email: string; role?: "STUDENT" | "INSTRUCTOR" | "ADMIN"; password?: string }) {
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role ?? "STUDENT",
      passwordHash: await bcrypt.hash(data.password ?? "senha12345", 12),
    },
  });
  return { user, token: signToken(user) };
}

export async function createCourse(instructorId: string, data?: { title?: string; priceCents?: number }) {
  const title = data?.title ?? `Curso ${Date.now()}`;
  return prisma.course.create({
    data: {
      title,
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      description: "Descrição válida com mais de dez caracteres",
      priceCents: data?.priceCents ?? 5000,
      instructorId,
      status: "PUBLISHED",
    },
  });
}

export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });
