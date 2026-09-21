"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { VideoUploader } from "@/components/admin/VideoUploader";

type Lesson = {
  id: string;
  title: string;
  type: "VIDEO" | "TEXT" | "QUIZ";
  videoAssetId: string | null;
  isFreePreview: boolean;
  courseId: string;
  courseTitle: string;
};

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function LessonEditor({ lesson: initial }: { lesson: Lesson }) {
  const router = useRouter();
  const [lesson, setLesson] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function patch(data: Partial<Lesson>, successMsg: string) {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(typeof updated.error === "string" ? updated.error : "Erro ao salvar");
      setLesson({ ...lesson, ...updated });
      toast.success(successMsg);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <label className="text-xs text-[#6B6862]">Título da aula</label>
        <div className="flex gap-2 mt-1">
          <input
            className="flex-1 border border-[#E5E3E0] rounded p-2 text-sm"
            value={lesson.title}
            onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
          />
          <button
            disabled={saving}
            onClick={() => { void patch({ title: lesson.title }, "Título salvo"); router.refresh(); }}
            className="bg-[#6D4FC7] text-white text-sm px-4 py-2 rounded disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#6B6862]">Vídeo</label>
        <div className="mt-1">
          <VideoUploader key={lesson.videoAssetId ?? "none"} lessonId={lesson.id} />
          {lesson.videoAssetId && <p className="text-[11px] text-[#6B6862] mt-1">Asset atual: {lesson.videoAssetId}</p>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm bg-white border border-[#E5E3E0] rounded-lg p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={lesson.isFreePreview}
          onChange={(e) => void patch({ isFreePreview: e.target.checked }, "Preview atualizado")}
        />
        Disponibilizar como aula gratuita (preview)
      </label>
    </div>
  );
}
