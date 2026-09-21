"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api";

function RedefinirSenhaForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/auth/redefinir-senha`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: pw }) });
    const data = await res.json();
    setMsg(res.ok ? "Senha redefinida! Faça login." : data.error);
  }
  return (
    <main className="max-w-sm mx-auto min-h-screen flex flex-col justify-center p-6">
      <h1 className="font-bebas text-3xl mb-4">Nova senha</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full bg-[#2A2340] rounded p-3 text-sm" placeholder="Nova senha" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="w-full bg-[#9B5DE5] font-bold text-sm p-3 rounded">Salvar</button>
      </form>
      {msg && <p className="text-xs mt-3">{msg}</p>}
    </main>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<main className="max-w-sm mx-auto min-h-screen flex flex-col justify-center p-6"><p className="text-sm">Carregando…</p></main>}>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
