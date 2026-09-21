import Link from "next/link";
import { HeroBanner } from "@/components/HeroBanner";
import { CourseCarousel } from "@/components/CourseCarousel";
import { API_URL } from "@/lib/api";

async function getCourses() {
  try {
    const res = await fetch(`${API_URL}/api/courses`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return [
      { id: "1", slug: "react-do-zero-ao-avancado", title: "React do Zero ao Avançado", description: "Curso · 42 aulas · Certificado incluso" },
      { id: "2", slug: "nodejs-na-pratica", title: "Node.js na Prática", description: "APIs robustas do zero" },
      { id: "3", slug: "ux-writing", title: "UX Writing na Prática", description: "Escreva para interfaces" },
      { id: "4", slug: "excel-avancado", title: "Excel Avançado", description: "Do básico ao VBA" },
      { id: "5", slug: "copywriting", title: "Copywriting", description: "Textos que convertem" },
    ];
  }
}

export default async function HomePage() {
  const courses = await getCourses();
  const hero = courses[0];
  return (
    <main className="max-w-md mx-auto min-h-screen pb-20">
      <HeroBanner course={hero} />
      <CourseCarousel title="Continue assistindo" courses={courses.slice(0, 3).map((c: { id: string; slug: string; title: string }, i: number) => ({ ...c, progressPercent: [70, 35, 90][i] ?? 10 }))} />
      <CourseCarousel title="Recomendados para você" courses={courses.slice(1, 4)} />
      <CourseCarousel title="Programação" courses={courses.slice(0, 3)} />
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-16 bg-black/95 border-t border-[#453A5C] flex items-center justify-around text-[10px] text-[#B3A9C2]">
        <Link href="/" className="text-white">⌂<br />Início</Link>
        <Link href="/meus-cursos">⌕<br />Buscar</Link>
        <Link href="/meus-cursos">⬇<br />Downloads</Link>
        <Link href="/meus-cursos">☰<br />Minha Lista</Link>
        <Link href="/admin">◍<br />Perfil</Link>
      </nav>
    </main>
  );
}
