"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Dashboard", href: "/admin", roles: ["ADMIN", "INSTRUCTOR"] },
  { label: "Cursos", href: "/admin/cursos", roles: ["ADMIN", "INSTRUCTOR"] },
  { label: "Alunos", href: "/admin/alunos", roles: ["ADMIN"] },
  { label: "Financeiro", href: "/admin/financeiro", roles: ["ADMIN"] },
  { label: "Planos", href: "/admin/planos", roles: ["ADMIN"] },
];

export function AdminSidebar({ role = "ADMIN" }: { role?: string }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => i.roles.includes(role));
  return (
    <aside className="w-60 border-r border-[#453A5C] bg-[#2A2340] hidden md:flex flex-col">
      <div className="p-4 font-bebas text-2xl tracking-wide text-[#F5F3F8]">Painel</div>
      <nav className="flex-1 px-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-1 ${
              pathname === item.href ? "bg-[#352C4D] text-[#D9B8FF] font-medium" : "text-[#B3A9C2]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function AdminTopbar({ userName = "Admin" }: { userName?: string }) {
  return (
    <header className="h-14 border-b border-[#453A5C] bg-[#2A2340] flex items-center justify-between px-6">
      <input placeholder="Busca global…" className="border border-[#453A5C] bg-[#1E1830] text-[#F5F3F8] placeholder:text-[#B3A9C2] rounded-md px-3 py-1.5 text-sm w-64" />
      <div className="flex items-center gap-3 text-sm text-[#F5F3F8]">
        <span>🔔</span>
        <span className="font-medium">{userName}</span>
      </div>
    </header>
  );
}
