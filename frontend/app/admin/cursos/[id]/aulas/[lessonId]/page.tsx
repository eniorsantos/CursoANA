import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { EmptyState } from "@/components/admin/EmptyState";
import { LessonEditor } from "@/components/admin/LessonEditor";

export default async function LessonEditorPage({ params }: { params: { id: string; lessonId: string } }) {
  const lesson = await adminFetch<{
    id: string;
    title: string;
    type: "VIDEO" | "TEXT" | "QUIZ";
    videoAssetId: string | null;
    isFreePreview: boolean;
    courseId: string;
    courseTitle: string;
  }>(`/api/admin/lessons/${params.lessonId}`);

  if (!lesson) {
    return (
      <EmptyState
        title="Aula não encontrada"
        description="Ela pode ter sido excluída ou você não tem permissão sobre ela."
        action={<Link href={`/admin/cursos/${params.id}`} className="text-sm text-[#6D4FC7]">← Voltar ao curso</Link>}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link href={`/admin/cursos/${params.id}`} className="text-sm text-[#6B6862]">← {lesson.courseTitle}</Link>
      </div>
      <h1 className="text-xl font-bold mb-4">{lesson.title}</h1>
      <LessonEditor lesson={lesson} />
    </div>
  );
}
