"use client";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import { saveSession } from "@/lib/auth-client";

export default function CadastroPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setMsg(JSON.stringify(data.error));
    saveSession(data.token);
    window.location.href = "/meus-cursos";
  }
  return (
    <main className="max-w-sm mx-auto min-h-screen flex flex-col justify-center p-6">
      <h1 className="font-bebas text-4xl mb-6">Criar conta</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full bg-[#2A2340] rounded p-3 text-sm" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full bg-[#2A2340] rounded p-3 text-sm" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="w-full bg-[#2A2340] rounded p-3 text-sm" placeholder="Senha (mín. 8)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {msg && <p className="text-xs text-red-400">{msg}</p>}
        <button className="w-full bg-[#9B5DE5] font-bold text-sm p-3 rounded">Cadastrar</button>
      </form>
    </main>
  );
}
