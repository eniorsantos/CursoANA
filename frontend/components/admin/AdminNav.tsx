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
    <aside className="w-60 border-r border-[#E5E3E0] bg-white hidden md:flex flex-col">
      <div className="p-4 font-bold text-lg text-[#18181B]">Painel</div>
      <nav className="flex-1 px-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-1 ${
              pathname === item.href ? "bg-[#EDE9FB] text-[#6D4FC7] font-medium" : "text-[#6B6862]"
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
    <header className="h-14 border-b border-[#E5E3E0] bg-white flex items-center justify-between px-6">
      <input placeholder="Busca global…" className="border border-[#E5E3E0] rounded-md px-3 py-1.5 text-sm w-64" />
      <div className="flex items-center gap-3 text-sm text-[#18181B]">
        <span>🔔</span>
        <span className="font-medium">{userName}</span>
      </div>
    </header>
  );
}
