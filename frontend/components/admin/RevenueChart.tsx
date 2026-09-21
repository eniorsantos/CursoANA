"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/api";

export function RevenueChart({ data }: { data: { date: string; revenueCents: number }[] }) {
  if (!data.length) {
    return (
      <div className="bg-white border border-[#E5E3E0] rounded-lg p-4">
        <div className="text-sm font-semibold mb-2">Receita — últimos 30 dias</div>
        <p className="text-xs text-[#6B6862]">Sem vendas pagas no período.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-[#E5E3E0] rounded-lg p-4">
      <div className="text-sm font-semibold mb-4">Receita — últimos 30 dias</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => `R$${Math.round(v / 100)}`} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(d) => `Dia ${d}`} />
          <Line type="monotone" dataKey="revenueCents" stroke="#6D4FC7" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
