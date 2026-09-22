"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/api";

export function RevenueChart({ data }: { data: { date: string; revenueCents: number }[] }) {
  if (!data.length) {
    return (
      <div className="bg-[#2A2340] border border-[#453A5C] rounded-lg p-4">
        <div className="text-sm font-semibold mb-2">Receita — últimos 30 dias</div>
        <p className="text-xs text-[#B3A9C2]">Sem vendas pagas no período.</p>
      </div>
    );
  }
  return (
    <div className="bg-[#2A2340] border border-[#453A5C] rounded-lg p-4">
      <div className="text-sm font-semibold mb-4">Receita — últimos 30 dias</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#B3A9C2" }} axisLine={{ stroke: "#453A5C" }} tickLine={false} />
          <YAxis tickFormatter={(v: number) => `R$${Math.round(v / 100)}`} tick={{ fontSize: 11, fill: "#B3A9C2" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            labelFormatter={(d) => `Dia ${d}`}
            contentStyle={{ backgroundColor: "#2A2340", borderColor: "#453A5C", borderRadius: 6, color: "#F5F3F8", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="revenueCents" stroke="#9B5DE5" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
