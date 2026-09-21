import { cookies } from "next/headers";
import { API_URL } from "./api";

// Fetch server-side para o painel admin: repassa o JWT do cookie como Bearer.
// Retorna null quando a API responde 401/erro (a página mostra estado vazio em vez de mock).
export async function adminFetch<T>(path: string): Promise<T | null> {
  const token = cookies().get("auth_token")?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
