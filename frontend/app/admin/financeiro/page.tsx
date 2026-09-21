import { formatCurrency } from "@/lib/api";
import { adminFetch } from "@/lib/admin-api";
import { EmptyState } from "@/components/admin/EmptyState";

type Finance = {
  totalRevenueCents: number;
  activeSubscriptions: number;
  mrrCents: number;
  churnRate: number;
  recentPayments: {
    id: string;
    amountCents: number;
    gateway: string;
    method: string;
    status: string;
    createdAt: string;
    user: { name: string };
    course: { title: string };
  }[];
};

export default async function FinanceiroPage() {
  const data = await adminFetch<Finance>("/api/admin/finance");

  if (!data) {
    return (
      <EmptyState
        title="Sem acesso ao financeiro"
        description="Esta área é exclusiva do papel ADMIN."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Receita total", formatCurrency(data.totalRevenueCents)],
          ["Assinaturas ativas", String(data.activeSubscriptions)],
          ["MRR", formatCurrency(data.mrrCents)],
          ["Churn", `${String(data.churnRate).replace(".", ",")}%`],
        ].map(([l, v]) => (
          <div key={l} className="bg-white border border-[#E5E3E0] rounded-lg p-4">
            <div className="text-xs text-[#6B6862]">{l}</div>
            <div className="text-xl font-bold">{v}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#E5E3E0] rounded-lg overflow-hidden">
        <div className="text-sm font-semibold p-4 pb-0">Pagamentos recentes</div>
        {data.recentPayments.length === 0 ? (
          <p className="text-xs text-[#6B6862] p-4">Nenhum pagamento registrado.</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead className="bg-[#F2F1EF]">
              <tr>{["Aluno", "Curso", "Valor", "Gateway", "Método", "Status"].map((h) => (<th key={h} className="text-left px-4 py-3 font-medium text-[#6B6862]">{h}</th>))}</tr>
            </thead>
            <tbody>
              {data.recentPayments.map((p) => (
                <tr key={p.id} className="border-t border-[#E5E3E0]">
                  <td className="px-4 py-3">{p.user.name}</td>
                  <td className="px-4 py-3">{p.course.title}</td>
                  <td className="px-4 py-3">{formatCurrency(p.amountCents)}</td>
                  <td className="px-4 py-3">{p.gateway === "MERCADO_PAGO" ? "Mercado Pago" : "Stripe"}</td>
                  <td className="px-4 py-3">{p.method}</td>
                  <td className={`px-4 py-3 ${p.status === "PAID" ? "text-green-700" : ""}`}>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
