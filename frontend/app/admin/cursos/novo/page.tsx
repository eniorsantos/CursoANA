"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";

export default function NovoCursoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", priceCents: "9900" });
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("auth_token");
    const res = await fetch(`${API_URL}/api/courses`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...form, priceCents: Number(form.priceCents) }),
    });
    const data = await res.json();
    if (!res.ok) {
      const message = typeof data.error === "string" ? data.error : "Verifique os campos destacados";
      toast.error(message);
      return;
    }
    toast.success("Curso criado como rascunho!");
    router.push(`/admin/cursos/${data.id}`);
  }
  return (
    <div className="max-w-xl">
      <h1 className="font-bebas text-3xl tracking-wide mb-4">Novo curso</h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-[#2A2340] border border-[#453A5C] rounded-lg p-5">
        <div><label className="text-xs text-[#B3A9C2]">Título</label><input className="w-full border rounded p-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="text-xs text-[#B3A9C2]">Descrição</label><textarea className="w-full border rounded p-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><label className="text-xs text-[#B3A9C2]">Preço (centavos)</label><input className="w-full border rounded p-2 text-sm" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} /></div>
        <button className="bg-[#9B5DE5] text-white text-sm px-4 py-2 rounded">Criar (nasce DRAFT)</button>
      </form>
    </div>
  );
}
