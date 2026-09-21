import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { EmptyState } from "@/components/admin/EmptyState";
import { CurriculumBuilder, type EditorModule } from "@/components/admin/CurriculumBuilder";
import { CourseInfoForm } from "@/components/admin/CourseInfoForm";
import { CourseActions } from "@/components/admin/CourseActions";

type Course = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  modules: EditorModule[];
};

export default async function CourseEditorPage({ params }: { params: { id: string } }) {
  const course = await adminFetch<Course>(`/api/admin/courses/${params.id}`);

  if (!course) {
    return (
      <EmptyState
        title="Curso não encontrado"
        description="Ele pode ter sido excluído ou você não tem permissão sobre ele."
        action={<Link href="/admin/cursos" className="text-sm text-[#6D4FC7]">← Voltar para cursos</Link>}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/cursos" className="text-sm text-[#6B6862]">← Cursos</Link>
        <h1 className="text-xl font-bold flex-1">{course.title}</h1>
        <CourseActions course={course} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold mb-2">Informações</h2>
          <CourseInfoForm course={course} />
        </div>
        <div>
          <h2 className="text-sm font-semibold mb-2">Currículo (arraste para reordenar)</h2>
          <CurriculumBuilder courseId={course.id} initialModules={course.modules} />
        </div>
      </div>
    </div>
  );
}
