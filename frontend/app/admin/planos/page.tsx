import { formatCurrency } from "@/lib/api";
import { adminFetch } from "@/lib/admin-api";
import { EmptyState } from "@/components/admin/EmptyState";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  interval: "MONTHLY" | "YEARLY";
  isAllCourses: boolean;
};

export default async function PlanosPage() {
  const plans = await adminFetch<Plan[]>("/api/plans");

  return (
    <div>
      <h1 className="font-bebas text-3xl tracking-wide mb-4">Planos de assinatura</h1>
      {!plans || plans.length === 0 ? (
        <EmptyState
          title="Nenhum plano criado ainda"
          description="Planos dão acesso recorrente via Stripe Subscription ou Mercado Pago Preapproval, com tolerância PAST_DUE antes de cortar o acesso."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <div key={p.id} className="bg-[#2A2340] border border-[#453A5C] rounded-lg p-5">
              <div className="font-semibold">{p.name} — {formatCurrency(p.priceCents)}/{p.interval === "MONTHLY" ? "mês" : "ano"}</div>
              <p className="text-xs text-[#B3A9C2] mt-1">{p.isAllCourses ? "Acesso a todos os cursos." : "Acesso a um subconjunto de cursos."}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
