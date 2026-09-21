"use client";
import { useState } from "react";
import * as UpChunk from "@mux/upchunk";
import { API_URL } from "@/lib/api";

type Status = "idle" | "uploading" | "processing" | "ready" | "mocked";

// Upload resumível direto do browser para o Mux (spec painel-admin §1.6):
// o arquivo nunca passa pelo servidor Next/Express.
export function VideoUploader({ lessonId }: { lessonId: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function pollUntilReady(uploadId: string) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`${API_URL}/api/admin/lessons/${lessonId}`, { headers: authHeaders() });
        if (!res.ok) continue;
        const lesson = await res.json();
        // O webhook video.asset.ready troca o upload_id pelo playback_id definitivo
        if (lesson.videoAssetId && lesson.videoAssetId !== uploadId) {
          setStatus("ready");
          return;
        }
      } catch {
        // mantém o polling
      }
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setProgress(0);

    const res = await fetch(`${API_URL}/api/lessons/admin/${lessonId}/upload`, {
      method: "POST",
      headers: authHeaders(),
    });
    const { uploadUrl, uploadId, mocked } = await res.json();

    if (mocked) {
      // Sem credenciais Mux: não há para onde enviar nem webhook de retorno.
      setStatus("mocked");
      return;
    }

    const upload = UpChunk.createUpload({ endpoint: uploadUrl, file, chunkSize: 5120 });
    upload.on("progress", (ev) => setProgress(Math.round((ev as CustomEvent<number>).detail)));
    upload.on("success", () => {
      setStatus("processing");
      void pollUntilReady(uploadId);
    });
    upload.on("error", () => setStatus("idle"));
  }

  return (
    <div className="border-2 border-dashed border-[#E5E3E0] rounded-lg p-6 text-center bg-white">
      {status === "idle" && <input type="file" accept="video/*" onChange={handleFileChange} className="text-sm" />}
      {status === "uploading" && <p className="text-sm">Enviando… {progress}%</p>}
      {status === "processing" && <p className="text-sm">Vídeo enviado! Processando (pode levar alguns minutos)…</p>}
      {status === "ready" && <p className="text-sm text-green-700">✓ Vídeo pronto</p>}
      {status === "mocked" && (
        <p className="text-sm text-[#6B6862]">Mux não configurado (sem MUX_TOKEN_ID) — configure as credenciais para upload real.</p>
      )}
    </div>
  );
}
