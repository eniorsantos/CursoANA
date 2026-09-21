"use client";
import { useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";

export type EditorLesson = {
  id: string;
  title: string;
  type: "VIDEO" | "TEXT" | "QUIZ";
  videoAssetId: string | null;
  isFreePreview: boolean;
  order: number;
};

export type EditorModule = {
  id: string;
  title: string;
  order: number;
  lessons: EditorLesson[];
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiCall(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Erro ${res.status}`);
  return data;
}

function VideoStatusBadge({ lesson }: { lesson: EditorLesson }) {
  if (lesson.type !== "VIDEO") return <span className="text-[11px] text-[#6B6862]">Texto/Quiz</span>;
  if (!lesson.videoAssetId) return <span className="text-[11px] px-2 py-0.5 rounded border border-[#E5E3E0] text-[#6B6862]">Sem vídeo</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded bg-green-100 text-green-800">Vídeo anexado</span>;
}

function SortableModule({
  courseId,
  module,
  onChanged,
}: {
  courseId: string;
  module: EditorModule;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(module.title);

  async function saveTitle() {
    try {
      await apiCall(`/api/admin/modules/${module.id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      toast.success("Módulo renomeado");
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addLesson() {
    try {
      await apiCall(`/api/courses/modules/${module.id}/lessons`, {
        method: "POST",
        body: JSON.stringify({ title: "Nova aula", type: "VIDEO" }),
      });
      toast.success("Aula criada");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteModule() {
    if (!confirm(`Excluir o módulo "${module.title}" e todas as suas aulas?`)) return;
    try {
      await apiCall(`/api/admin/modules/${module.id}`, { method: "DELETE" });
      toast.success("Módulo excluído");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteLesson(lesson: EditorLesson) {
    if (!confirm(`Excluir a aula "${lesson.title}"?`)) return;
    try {
      await apiCall(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" });
      toast.success("Aula excluída");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="border border-[#E5E3E0] rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-[#F2F1EF]">
        <span {...attributes} {...listeners} className="cursor-grab text-[#6B6862] select-none" title="Arrastar para reordenar">⠿</span>
        {editing ? (
          <span className="flex gap-2 flex-1">
            <input className="flex-1 border rounded px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button onClick={saveTitle} className="text-xs text-[#6D4FC7] font-medium">Salvar</button>
          </span>
        ) : (
          <button onClick={() => { setTitle(module.title); setEditing(true); }} className="font-medium text-sm text-left flex-1" title="Clique para renomear">
            {module.title}
          </button>
        )}
        <span className="text-xs text-[#6B6862]">{module.lessons.length} aulas</span>
        <button onClick={deleteModule} className="text-xs text-red-700" title="Excluir módulo">Excluir</button>
      </div>
      <div className="p-2">
        {module.lessons.map((lesson) => (
          <div key={lesson.id} className="flex items-center gap-2 p-2 rounded hover:bg-[#F2F1EF] text-sm">
            <span className="text-[#6B6862]">≡</span>
            <Link href={`/admin/cursos/${courseId}/aulas/${lesson.id}`} className="flex-1 truncate" title="Abrir editor da aula">
              {lesson.title}
            </Link>
            {lesson.isFreePreview && <span className="text-[11px] px-2 py-0.5 rounded bg-[#EDE9FB] text-[#6D4FC7]">Gratuita</span>}
            <VideoStatusBadge lesson={lesson} />
            <button onClick={() => { router.push(`/admin/cursos/${courseId}/aulas/${lesson.id}`); }} className="text-xs text-[#6D4FC7]">Editar</button>
            <button onClick={() => deleteLesson(lesson)} className="text-xs text-red-700">✕</button>
          </div>
        ))}
        <button className="text-xs text-[#6D4FC7] p-2" onClick={addLesson}>+ Adicionar aula</button>
      </div>
    </div>
  );
}

export function CurriculumBuilder({ courseId, initialModules }: { courseId: string; initialModules: EditorModule[] }) {
  const router = useRouter();
  const [modules, setModules] = useState<EditorModule[]>(initialModules);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(modules, oldIndex, newIndex);
    setModules(reordered); // otimista
    try {
      await apiCall(`/api/courses/${courseId}/modules/reorder`, {
        method: "POST",
        body: JSON.stringify({ orderedIds: reordered.map((m) => m.id) }),
      });
    } catch (e) {
      toast.error((e as Error).message);
      router.refresh();
    }
  }

  async function addModule() {
    try {
      await apiCall(`/api/courses/${courseId}/modules`, {
        method: "POST",
        body: JSON.stringify({ title: "Novo módulo" }),
      });
      toast.success("Módulo criado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {modules.map((module) => (
            <SortableModule key={module.id} courseId={courseId} module={module} onChanged={() => router.refresh()} />
          ))}
        </SortableContext>
      </DndContext>
      {modules.length === 0 && <p className="text-sm text-[#6B6862]">Nenhum módulo ainda — o curso só pode ser publicado com ao menos um.</p>}
      <button onClick={addModule} className="border border-[#E5E3E0] bg-white rounded-md px-4 py-2 text-sm text-[#6D4FC7]">
        + Adicionar módulo
      </button>
    </div>
  );
}
