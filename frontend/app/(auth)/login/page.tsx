"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { saveSession } from "@/lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Falha no login");
    saveSession(data.token);
    router.push("/meus-cursos");
  }

  return (
    <main className="max-w-sm mx-auto min-h-screen flex flex-col justify-center p-6">
      <h1 className="font-bebas text-4xl mb-6">Entrar</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full bg-[#2A2340] rounded p-3 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full bg-[#2A2340] rounded p-3 text-sm" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button className="w-full bg-[#9B5DE5] font-bold text-sm p-3 rounded">Entrar</button>
      </form>
      {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
        <button onClick={() => (window.location.href = `${API_URL}/api/auth/google`)} className="w-full border border-[#453A5C] rounded p-3 mt-3 text-sm">Entrar com Google</button>
      )}
      <p className="text-xs text-[#B3A9C2] mt-4 text-center"><a href="/cadastro" className="underline">Criar conta</a> · <a href="/recuperar-senha" className="underline">Esqueci a senha</a></p>
    </main>
  );
}
