"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";

// Ações por linha da tabela de cursos, com feedback padronizado via sonner.
export function CourseActions({ course }: { course: { id: string; status: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function publish() {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/courses/${course.id}/publish`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) toast.error(typeof data.error === "string" ? data.error : "Não foi possível publicar");
      else {
        toast.success("Curso publicado!");
        router.refresh();
      }
    } catch {
      toast.error("Erro de rede ao publicar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex gap-3">
      <Link href={`/admin/cursos/${course.id}`} className="text-[#D9B8FF]">Editar</Link>
      {course.status === "DRAFT" && (
        <button onClick={publish} disabled={loading} className="text-[#D9B8FF] disabled:opacity-50">
          {loading ? "Publicando…" : "Publicar"}
        </button>
      )}
    </span>
  );
}
