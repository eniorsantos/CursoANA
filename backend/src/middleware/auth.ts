import type { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../lib/auth.js";

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const user = await getUserFromToken(header.slice(7));
      if (user) (req as unknown as { user: typeof user }).user = user;
    } catch {
      // token inválido -> segue sem usuário
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as unknown as { user?: { id: string } }).user;
  if (!user) return res.status(401).json({ error: "Não autenticado" });
  next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as unknown as { user?: { id: string; role: string } }).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: "Não autorizado" });
    }
    next();
  };
}

export async function assertOwnsCourse(
  user: { id: string; role: string },
  courseInstructorId: string
) {
  if (user.role === "ADMIN") return;
  if (courseInstructorId !== user.id) {
    throw new Error("Você não tem permissão para editar este curso");
  }
}
