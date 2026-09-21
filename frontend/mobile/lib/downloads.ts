import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Application from "expo-application";
import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";
import { API_URL } from "./api";
import { getToken } from "./auth";

// Downloads offline (spec §8): rendition MP4 única (não HLS adaptativo), arquivo
// criptografado com AES (chave derivada de userId + deviceId) e expiração de 30 dias
// ou perda de acesso (checagem a cada abertura do app).
// Limitação honesta: a cifragem é sobre o base64 em memória — adequada a aulas
// curtas; vídeos muito longos devem usar righteous streaming + DRM.
export type DownloadMeta = {
  lessonId: string;
  title: string;
  encUri: string;
  sizeBytes: number;
  downloadedAt: string;
  expiresAt: string;
};

const DIR = `${FileSystem.documentDirectory}downloads/`;
const INDEX = `${DIR}index.json`;
const EXPIRY_DAYS = 30;

async function deviceId(): Promise<string> {
  const androidId = Application.getAndroidId();
  const iosId = await Application.getIosIdForVendorAsync().catch(() => null);
  return androidId ?? iosId ?? "unknown-device";
}

async function encryptionKey(userId: string): Promise<string> {
  const id = await deviceId();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${userId}:${id}`);
}

async function readIndex(): Promise<DownloadMeta[]> {
  const info = await FileSystem.getInfoAsync(INDEX);
  if (!info.exists) return [];
  const raw = await FileSystem.readAsStringAsync(INDEX);
  return JSON.parse(raw) as DownloadMeta[];
}

async function writeIndex(items: DownloadMeta[]) {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(INDEX, JSON.stringify(items));
}

export async function listDownloads(): Promise<DownloadMeta[]> {
  return readIndex();
}

export async function downloadLesson(
  lessonId: string,
  title: string,
  userId: string,
  onProgress: (percent: number) => void
): Promise<DownloadMeta> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/lessons/${lessonId}/download-url`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download não autorizado");
  const { url } = (await res.json()) as { url: string };

  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  const tmpUri = `${DIR}${lessonId}.mp4`;
  const resumable = FileSystem.createDownloadResumable(url, tmpUri, {}, (p) => {
    onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const result = await resumable.downloadAsync();
  if (!result) throw new Error("Falha no download");

  // Cifra o conteúdo (base64 → AES) e remove o original em claro
  const key = await encryptionKey(userId);
  const b64 = await FileSystem.readAsStringAsync(tmpUri, { encoding: FileSystem.EncodingType.Base64 });
  const encUri = `${DIR}${lessonId}.enc`;
  await FileSystem.writeAsStringAsync(encUri, AES.encrypt(b64, key).toString());
  await FileSystem.deleteAsync(tmpUri, { idempotent: true });
  const info = await FileSystem.getInfoAsync(encUri);

  const meta: DownloadMeta = {
    lessonId,
    title,
    encUri,
    sizeBytes: info.exists && "size" in info ? (info.size as number) : 0,
    downloadedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + EXPIRY_DAYS * 24 * 3600 * 1000).toISOString(),
  };
  const items = (await readIndex()).filter((d) => d.lessonId !== lessonId);
  items.push(meta);
  await writeIndex(items);
  return meta;
}

// Decifra em memória para um arquivo temporário e devolve a URI para o player.
// O chamador deve apagar com `clearTempPlayback` ao sair da tela.
export async function tempPlaybackUri(lessonId: string, userId: string): Promise<string> {
  const items = await readIndex();
  const meta = items.find((d) => d.lessonId === lessonId);
  if (!meta) throw new Error("Aula não baixada");
  if (new Date(meta.expiresAt) < new Date()) throw new Error("Download expirado");

  const key = await encryptionKey(userId);
  const cipher = await FileSystem.readAsStringAsync(meta.encUri);
  const b64 = AES.decrypt(cipher, key).toString(Utf8);
  const tmpUri = `${FileSystem.cacheDirectory}play-${lessonId}.mp4`;
  await FileSystem.writeAsStringAsync(tmpUri, b64, { encoding: FileSystem.EncodingType.Base64 });
  return tmpUri;
}

export async function clearTempPlayback(lessonId: string) {
  await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}play-${lessonId}.mp4`, { idempotent: true });
}

export async function removeDownload(lessonId: string) {
  const items = await readIndex();
  const meta = items.find((d) => d.lessonId === lessonId);
  if (meta) await FileSystem.deleteAsync(meta.encUri, { idempotent: true });
  await writeIndex(items.filter((d) => d.lessonId !== lessonId));
}

// Expiração: remove downloads vencidos ou sem acesso (assinatura cancelada).
// Chamado a cada abertura do app.
export async function purgeExpired(userId: string): Promise<void> {
  const token = await getToken();
  const items = await readIndex();
  const kept: DownloadMeta[] = [];
  for (const meta of items) {
    const expired = new Date(meta.expiresAt) < new Date();
    let hasAccess = !expired;
    if (hasAccess) {
      try {
        // Revalida o acesso via playback-url (403 = perdeu acesso ao curso)
        const probe = await fetch(`${API_URL}/api/lessons/${meta.lessonId}/playback-url`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        hasAccess = probe.ok;
      } catch {
        hasAccess = true; // sem rede: mantém (falha aberta, revalida na próxima)
      }
    }
    if (expired || !hasAccess) {
      await FileSystem.deleteAsync(meta.encUri, { idempotent: true });
    } else {
      kept.push(meta);
    }
  }
  await writeIndex(kept);
}

export async function totalDownloadBytes(): Promise<number> {
  const items = await readIndex();
  return items.reduce((s, d) => s + d.sizeBytes, 0);
}
