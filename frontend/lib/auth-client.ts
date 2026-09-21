// Sessão no client: espelha o JWT no localStorage (uso na API via Authorization)
// e num cookie legível (uso no middleware de borda para gating de rotas).
// A segurança real continua no backend (requireAuth/requireRole) — o middleware
// é defesa em profundidade para navegação, não substitui a checagem da API.

export function saveSession(token: string) {
  localStorage.setItem("auth_token", token);
  const maxAge = 60 * 60 * 24 * 30; // 30d, igual ao JWT
  document.cookie = `auth_token=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem("auth_token");
  document.cookie = "auth_token=; Path=/; Max-Age=0; SameSite=Lax";
}

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}
