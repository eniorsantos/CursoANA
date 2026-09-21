"use client";
import Link from "next/link";

const GRADIENTS = [
  "linear-gradient(160deg,#6A2C91,#2B0F3D)",
  "linear-gradient(160deg,#4A3F91,#1A1730)",
  "linear-gradient(160deg,#7C3AAD,#2E1240)",
  "linear-gradient(160deg,#5B3E9E,#201735)",
];

export type CardCourse = { id: string; slug: string; title: string; progressPercent?: number };

export function CourseCard({ course, index = 0 }: { course: CardCourse; index?: number }) {
  return (
    <Link href={`/curso/${course.slug}`} className="shrink-0 w-[120px]">
      <div className="relative w-[120px] h-[170px] rounded overflow-hidden flex items-end p-2" style={{ background: GRADIENTS[index % GRADIENTS.length] }}>
        <span className="text-[11px] font-bold leading-tight">{course.title}</span>
        {course.progressPercent !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
            <div className="h-full bg-[#9B5DE5]" style={{ width: `${course.progressPercent}%` }} />
          </div>
        )}
      </div>
    </Link>
  );
}

export function CourseCarousel({ title, courses }: { title: string; courses: CardCourse[] }) {
  if (!courses.length) return null;
  return (
    <section className="py-3">
      <h2 className="text-sm font-bold px-5 pb-2">{title}</h2>
      <div className="flex gap-2 px-5 overflow-x-auto no-scrollbar">
        {courses.map((c, i) => (
          <CourseCard key={c.id} course={c} index={i} />
        ))}
      </div>
    </section>
  );
}
