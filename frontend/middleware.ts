import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Defesa em profundidade (spec painel-admin §2.5/§2.7): barra a navegação antes da
// página carregar. A autorização real continua no backend (requireRole), pois
// Server Components/actions equivalentes aqui são as chamadas REST à API.
function getRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value ?? null;
  const role = token ? getRoleFromToken(token) : null;

  const isAdminRoute = pathname.startsWith("/admin");
  const isStudentRoute =
    pathname.startsWith("/meus-cursos") ||
    pathname.startsWith("/curso/") ||
    pathname.startsWith("/player/") ||
    pathname.startsWith("/checkout/") ||
    pathname.startsWith("/perfil");
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/cadastro");

  if (isAdminRoute && (!token || (role !== "ADMIN" && role !== "INSTRUCTOR"))) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isStudentRoute && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/meus-cursos", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/meus-cursos/:path*", "/curso/:path*", "/player/:path*", "/checkout/:path*", "/perfil", "/login", "/cadastro"],
};
