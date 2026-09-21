"use client";
import Link from "next/link";

export function HeroBanner({ course }: { course: { title: string; description: string; slug: string } }) {
  return (
    <section className="relative h-[420px] flex items-end" style={{ background: "linear-gradient(135deg,#4A2E7A,#1F1929 70%)" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 40%,#1E1830 100%)" }} />
      <div className="relative z-10 p-6 w-full">
        <span className="inline-block bg-[#D9B8FF] text-[#2A2033] text-[10px] font-extrabold px-2 py-0.5 rounded-sm mb-2">EM ALTA</span>
        <h1 className="font-bebas text-4xl leading-none mb-1">{course.title}</h1>
        <p className="text-xs text-[#B3A9C2] mb-4 line-clamp-2">{course.description}</p>
        <div className="flex gap-2">
          <Link href={`/curso/${course.slug}`} className="bg-white text-black text-sm font-bold px-4 py-2 rounded">▶ Assistir</Link>
          <Link href={`/curso/${course.slug}`} className="bg-white/20 text-white text-sm font-bold px-4 py-2 rounded">ⓘ Detalhes</Link>
        </div>
      </div>
    </section>
  );
}
