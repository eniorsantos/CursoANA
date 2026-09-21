import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// Mux — URL assinada HLS com expiração de 4h (spec Parte 2).
export function getSignedPlaybackUrl(playbackId: string): string {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const keyPrivate = process.env.MUX_SIGNING_KEY_PRIVATE;
  if (!keyId || !keyPrivate) {
    // Fallback dev: retorna URL pública de teste (sem assinatura real)
    return `https://stream.mux.com/${playbackId}.m3u8`;
  }
  const token = jwt.sign(
    { sub: playbackId, aud: "v", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4 },
    Buffer.from(keyPrivate, "base64").toString("utf-8"),
    { algorithm: "RS256", keyid: keyId }
  );
  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
}

// Bunny Stream — alternativa com token SHA256.
export function getBunnySignedUrl(videoId: string, libraryId: string): string {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 4;
  const securityKey = process.env.BUNNY_TOKEN_SECURITY_KEY ?? "dev-key";
  const path = `/${libraryId}/${videoId}`;
  const hash = crypto.createHash("sha256").update(securityKey + path + expires).digest("hex");
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${hash}&expires=${expires}`;
}
