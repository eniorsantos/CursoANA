"use client";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";

export function CourseInfoForm({ course }: { course: { id: string; title: string; description: string; priceCents: number } }) {
  const [form, setForm] = useState({ title: course.title, description: course.description, priceCents: String(course.priceCents) });
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...form, priceCents: Number(form.priceCents) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Verifique os campos");
      toast.success("Curso atualizado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl bg-[#2A2340] border border-[#453A5C] rounded-lg p-5">
      <div>
        <label className="text-xs text-[#B3A9C2]">Título</label>
        <input className="w-full border border-[#453A5C] rounded p-2 text-sm mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-[#B3A9C2]">Descrição</label>
        <textarea className="w-full border border-[#453A5C] rounded p-2 text-sm mt-1" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-[#B3A9C2]">Preço (centavos)</label>
        <input className="w-full border border-[#453A5C] rounded p-2 text-sm mt-1" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} />
      </div>
      <button disabled={saving} className="bg-[#9B5DE5] text-white text-sm px-4 py-2 rounded disabled:opacity-50">
        {saving ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
