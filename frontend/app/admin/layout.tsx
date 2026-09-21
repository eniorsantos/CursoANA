import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar, AdminTopbar } from "@/components/admin/AdminNav";
import { AdminToaster } from "@/components/admin/AdminToaster";

function getRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("auth_token")?.value ?? null;
  const role = token ? getRoleFromToken(token) : null;

  // Espelha no frontend a mesma regra do backend (requireRole): só ADMIN/INSTRUCTOR.
  // A autorização real continua na API — isto é gating de navegação.
  if (!token || (role !== "ADMIN" && role !== "INSTRUCTOR")) {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="flex h-screen bg-[#FAFAF9] text-[#18181B]">
      <AdminSidebar role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar userName={role === "ADMIN" ? "Admin" : "Instrutor"} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <AdminToaster />
    </div>
  );
}
