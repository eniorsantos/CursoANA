import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api";

// Checkout iOS (spec §9): abre no navegador do sistema, não em WebView embutida —
// mais seguro e mais aceito na revisão da App Store (MVP sem IAP; validar com
// compliance antes de escalar, pois a Apple pode exigir In-App Purchase).
export async function openCheckout(courseId: string, token: string | null) {
  const res = await fetch(`${API_URL}/api/checkout/stripe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ courseId }),
  });
  const { url } = (await res.json()) as { url: string };
  await WebBrowser.openBrowserAsync(url);
}
