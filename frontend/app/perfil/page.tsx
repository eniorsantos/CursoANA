"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { clearSession } from "@/lib/auth-client";

type Me = { name: string; email: string; role: string; termsAcceptedAt: string | null };

export default function PerfilPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(`${API_URL}/api/users/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function deleteAccount() {
    setDeleting(true);
    const token = localStorage.getItem("auth_token");
    const res = await fetch(`${API_URL}/api/users/me`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      clearSession();
      window.location.href = "/?conta-excluida=1";
    }
    setDeleting(false);
  }

  return (
    <main className="max-w-md mx-auto min-h-screen p-5">
      <h1 className="font-bebas text-3xl mb-4">Perfil</h1>
      {!me ? (
        <p className="text-sm text-[#B3A9C2]">Carregando…</p>
      ) : (
        <div className="bg-[#2A2340] rounded-lg p-4 space-y-1 text-sm">
          <p><strong>{me.name}</strong></p>
          <p className="text-[#B3A9C2]">{me.email}</p>
          <p className="text-[#B3A9C2] text-xs">Papel: {me.role}</p>
          <p className="text-[#B3A9C2] text-xs">
            Termos aceitos em: {me.termsAcceptedAt ? new Date(me.termsAcceptedAt).toLocaleDateString("pt-BR") : "—"}
          </p>
          <p className="text-xs pt-2"><a href="/privacidade" className="underline text-[#D9B8FF]">Política de privacidade</a></p>
        </div>
      )}
      <div className="mt-6 border border-red-900/50 rounded-lg p-4">
        <h2 className="text-sm font-bold text-red-400 mb-1">Zona de perigo</h2>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-xs text-red-400 underline">Excluir minha conta</button>
        ) : (
          <div className="text-xs space-y-2">
            <p className="text-[#B3A9C2]">Isso anonimiza seu cadastro, apaga seu progresso e cancela matrículas e assinaturas. Não pode ser desfeito.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="border border-[#453A5C] rounded px-3 py-1.5">Cancelar</button>
              <button onClick={deleteAccount} disabled={deleting} className="bg-red-700 rounded px-3 py-1.5 font-bold disabled:opacity-50">
                {deleting ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
