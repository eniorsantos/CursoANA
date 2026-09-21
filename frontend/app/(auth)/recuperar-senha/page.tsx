"use client";
import { useState } from "react";
import { API_URL } from "@/lib/api";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${API_URL}/api/auth/recuperar-senha`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setDone(true);
  }
  return (
    <main className="max-w-sm mx-auto min-h-screen flex flex-col justify-center p-6">
      <h1 className="font-bebas text-3xl mb-4">Recuperar senha</h1>
      {done ? <p className="text-sm text-[#B3A9C2]">Se o email existir, enviamos um link válido por 30 minutos.</p> : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="w-full bg-[#2A2340] rounded p-3 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="w-full bg-[#9B5DE5] font-bold text-sm p-3 rounded">Enviar link</button>
        </form>
      )}
    </main>
  );
}
