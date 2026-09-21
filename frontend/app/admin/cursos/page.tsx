import Link from "next/link";
import { formatCurrency } from "@/lib/api";
import { adminFetch } from "@/lib/admin-api";
import { EmptyState } from "@/components/admin/EmptyState";
import { CourseActions } from "@/components/admin/CourseActions";

type AdminCourse = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  priceCents: number;
  instructor: { name: string };
  _count: { enrollments: number; modules: number };
};

const STATUS_LABEL: Record<AdminCourse["status"], string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

export default async function CursosAdminPage() {
  const courses = await adminFetch<AdminCourse[]>("/api/admin/courses");

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Cursos</h1>
        <Link href="/admin/cursos/novo" className="bg-[#6D4FC7] text-white text-sm px-4 py-2 rounded-md">+ Novo curso</Link>
      </div>
      {!courses || courses.length === 0 ? (
        <EmptyState
          title="Nenhum curso criado ainda"
          description="Comece criando seu primeiro curso para a plataforma."
          action={<Link href="/admin/cursos/novo" className="bg-[#6D4FC7] text-white text-sm px-4 py-2 rounded-md">Criar primeiro curso</Link>}
        />
      ) : (
        <table className="w-full text-sm border border-[#E5E3E0] rounded-lg overflow-hidden bg-white">
          <thead className="bg-[#F2F1EF]">
            <tr>{["Curso", "Status", "Preço", "Alunos", "Ações"].map((h) => (<th key={h} className="text-left px-4 py-3 font-medium text-[#6B6862]">{h}</th>))}</tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-[#E5E3E0] hover:bg-[#F2F1EF]">
                <td className="px-4 py-3">
                  <span className="font-medium">{c.title}</span>
                  <span className="block text-xs text-[#6B6862]">{c.instructor.name} · {c._count.modules} módulos</span>
                </td>
                <td className="px-4 py-3">{STATUS_LABEL[c.status]}</td>
                <td className="px-4 py-3">{formatCurrency(c.priceCents)}</td>
                <td className="px-4 py-3">{c._count.enrollments}</td>
                <td className="px-4 py-3"><CourseActions course={c} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
