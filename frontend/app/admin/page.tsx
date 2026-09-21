import { formatCurrency } from "@/lib/api";
import { adminFetch } from "@/lib/admin-api";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { EmptyState } from "@/components/admin/EmptyState";
import Link from "next/link";

type Dashboard = {
  monthlyRevenueCents: number;
  newStudents: number;
  publishedCourses: number;
  revenueTrend: number;
  studentsTrend: number;
  revenueByDay: { date: string; revenueCents: number }[];
  topCourses: { id: string; title: string; _count: { enrollments: number } }[];
};

function StatCard({ label, value, trend }: { label: string; value: string; trend?: number }) {
  return (
    <div className="bg-white border border-[#E5E3E0] rounded-lg p-4">
      <div className="text-xs text-[#6B6862] mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {trend !== undefined && (
        <div className={`text-xs mt-1 ${trend >= 0 ? "text-green-700" : "text-red-700"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs. mês anterior
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await adminFetch<Dashboard>("/api/admin/dashboard");

  if (!stats) {
    return (
      <EmptyState
        title="Não foi possível carregar o dashboard"
        description="Verifique se o backend está rodando e se sua sessão é de admin/instrutor."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Receita no mês" value={formatCurrency(stats.monthlyRevenueCents)} trend={stats.revenueTrend} />
        <StatCard label="Novos alunos" value={String(stats.newStudents)} trend={stats.studentsTrend} />
        <StatCard label="Cursos publicados" value={String(stats.publishedCourses)} />
      </div>
      <RevenueChart data={stats.revenueByDay} />
      <div className="bg-white border border-[#E5E3E0] rounded-lg p-4">
        <div className="text-sm font-semibold mb-2">Cursos com melhor desempenho</div>
        {stats.topCourses.length === 0 ? (
          <p className="text-xs text-[#6B6862]">Nenhum curso ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {stats.topCourses.map((c) => (
                <tr key={c.id} className="border-t border-[#E5E3E0]">
                  <td className="py-2">
                    <Link href={`/admin/cursos/${c.id}`} className="text-[#6D4FC7]">{c.title}</Link>
                  </td>
                  <td className="py-2 text-right text-[#6B6862]">{c._count.enrollments} alunos</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
