"use client";

import { useState, useEffect } from "react";
import { PageShell, KpiCard, GlassCard } from "@/components/ui/Premium";
import BillingFilters, { Filters } from "@/components/billing/BillingFilters";
import { DollarSign, CreditCard, CheckCircle2, Wallet, BarChart3, Building2, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const BLUE = "#003887";

export default function ActualBillingPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    fetch(`/api/billing/summary?${qs}`).then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, [filters]);

  const t = data?.totals;
  const b = data?.actualBreakdown ?? {};
  const bars = [
    { name: "Regular", value: b.regular ?? 0 }, { name: "Agency", value: b.agency ?? 0 },
    { name: "Early/Late", value: b.earlyLate ?? 0 }, { name: "One Time", value: b.oneTime ?? 0 },
    { name: "Other", value: b.other ?? 0 }, { name: "Discount", value: b.discount ?? 0 }, { name: "Adjustments", value: b.adjustments ?? 0 },
  ];

  return (
    <PageShell title="Actual Billing" subtitle="What was billed — FIN14-AR transactions, categorized">
      <BillingFilters value={filters} onChange={setFilters} showSearch={false} />
      {loading && <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>}
      {!loading && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Actual Billed" value={formatCurrency(t.actual)} icon={DollarSign} color="#22c55e" />
            <KpiCard label="Regular Tuition" value={formatCurrency(b.regular ?? 0)} icon={CreditCard} color={BLUE} />
            <KpiCard label="Agency Billed" value={formatCurrency(b.agency ?? 0)} icon={Wallet} color="#06b6d4" />
            <KpiCard label="Collected" value={formatCurrency(t.collected)} icon={CheckCircle2} color="#8b5cf6" />
          </div>

          <GlassCard title="Actual Billed by Category" icon={BarChart3} bodyClassName="p-5">
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={bars} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={((v: number) => formatCurrency(v)) as any} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>{bars.map((d) => <Cell key={d.name} fill={d.value < 0 ? "#ef4444" : BLUE} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-slate-400 mt-2">Discounts and Adjustments are negative (they reduce the bill). Payments are tracked separately as Collected.</p>
          </GlassCard>

          <GlassCard title="By Center" icon={Building2}
            actions={<a href="/reports/billing" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: BLUE }}>All records <ArrowUpRight className="w-3 h-3" /></a>}>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80 sticky top-0 backdrop-blur"><tr className="text-slate-400">
                  {["Center", "Entity", "Kids", "Actual"].map((h, i) => <th key={h} className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {data.byCenter.map((c: any) => (
                    <tr key={c.center} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, center: c.center })}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.center}</td>
                      <td className="px-4 py-3 text-slate-500">{c.entity ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatNumber(c.kids)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(c.actual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </PageShell>
  );
}
