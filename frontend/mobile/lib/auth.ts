import * as SecureStore from "expo-secure-store";
import { API_URL } from "./api";

// Autenticação mobile (spec §6.2): JWT persistido em SecureStore, nunca cookie.
export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Credenciais inválidas");
  const { token, user } = (await res.json()) as { token: string; user: { id: string } };
  await SecureStore.setItemAsync("auth_token", token);
  await SecureStore.setItemAsync("user_id", user.id);
  return token;
}

export async function logout() {
  await SecureStore.deleteItemAsync("auth_token");
  await SecureStore.deleteItemAsync("user_id");
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync("auth_token");
}

export async function getUserId(): Promise<string | null> {
  return SecureStore.getItemAsync("user_id");
}
