import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
const JWT_EXPIRES = "30d";

export type AuthUser = { id: string; role: string; email: string; name: string };

export async function validateCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export function signToken(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): { sub: string; role: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
}

export async function getUserFromToken(token: string) {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  return user;
}
