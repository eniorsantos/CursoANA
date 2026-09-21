import Link from "next/link";
import { API_URL } from "@/lib/api";
import { CourseCarousel } from "@/components/CourseCarousel";

async function getCourse(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/courses/${slug}`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return {
      title: "Node.js na Prática", slug, description: "Construa APIs robustas do zero, com autenticação, filas e testes automatizados. Inclui certificado de conclusão.",
      modules: [
        { id: "m1", title: "Módulo 1 — Fundamentos", lessons: [{ id: "l1", title: "Configurando o ambiente" }, { id: "l2", title: "Primeiro servidor HTTP" }] },
        { id: "m2", title: "Módulo 2 — Banco de Dados", lessons: [] },
        { id: "m3", title: "Módulo 3 — Autenticação", lessons: [] },
      ],
    };
  }
}

export default async function CourseDetail({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  return (
    <main className="max-w-md mx-auto min-h-screen pb-10">
      <div className="h-[220px] flex items-end p-4" style={{ background: "linear-gradient(150deg,#4A3F91,#1E1830 75%)" }}>
        <h1 className="font-bebas text-3xl">{course.title}</h1>
      </div>
      <div className="p-5">
        <div className="flex gap-2 text-[11px] text-[#B3A9C2] mb-2"><span>2024</span><span>·</span><span>{course.modules?.length ?? 3} módulos</span><span>·</span><span>Intermediário</span></div>
        <p className="text-xs text-[#B3A9C2] leading-relaxed mb-4">{course.description}</p>
        {firstLesson ? (
          <Link href={`/player/${firstLesson.id}`} className="block w-full bg-[#9B5DE5] text-white font-bold text-sm p-3 rounded text-center mb-5">▶ Assistir agora</Link>
        ) : (
          <Link href={`/checkout/${course.id ?? course.slug}`} className="block w-full bg-[#9B5DE5] text-white font-bold text-sm p-3 rounded text-center mb-5">▶ Assistir agora</Link>
        )}
        {(course.modules ?? []).map((m: { id: string; title: string; lessons: { id: string; title: string }[] }) => (
          <div key={m.id} className="border-b border-[#453A5C] py-2">
            <div className="flex justify-between text-xs py-1"><span>{m.title}</span><span className="text-[#B3A9C2]">{m.lessons.length} aulas</span></div>
            {m.lessons.map((l) => (
              <Link key={l.id} href={`/player/${l.id}`} className="flex items-center gap-2 py-1.5 text-[11px] text-[#B3A9C2]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D9B8FF]" />{l.title}
              </Link>
            ))}
          </div>
        ))}
        <h3 className="text-sm font-bold mt-4 mb-2">Cursos relacionados</h3>
        <CourseCarousel title="" courses={[{ id: "r1", slug: "typescript-pro", title: "TypeScript Pro" }, { id: "r2", slug: "sql-para-devs", title: "SQL para Devs" }]} />
      </div>
    </main>
  );
}
