import { CourseCarousel } from "@/components/CourseCarousel";

export default function MeusCursosPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen p-5">
      <h1 className="font-bebas text-3xl mb-4">Meus cursos</h1>
      <CourseCarousel title="Minha lista" courses={[{ id: "1", slug: "react-do-zero-ao-avancado", title: "React do Zero", progressPercent: 70 }]} />
      <p className="text-xs text-[#B3A9C2]">O progresso é atualizado a cada 15s de vídeo assistido. Aulas concluídas a ~90%.</p>
    </main>
  );
}
