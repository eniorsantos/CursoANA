import Constants from "expo-constants";

const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? extraUrl ?? "http://localhost:4000";

export type ApiCourse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl?: string | null;
  progressPercent?: number;
};

export async function api<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}
