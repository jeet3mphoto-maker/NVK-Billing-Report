"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, KpiCard, GlassCard, GhostButton } from "@/components/ui/Premium";
import BillingFilters, { Filters, CATEGORY_LABEL } from "@/components/billing/BillingFilters";
import {
  DollarSign, TrendingUp, TrendingDown, CheckCircle2, Activity,
  Building2, Users, AlertTriangle, Scale, Wallet, ArrowUpRight, PieChart, BarChart3,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";

const BLUE = "#003887";
const CAT_COLOR: Record<string, string> = {
  MATCHED: "#22c55e", FRACTIONAL_DIFFERENCE: "#84cc16", SHORT_BILLING: "#3b82f6",
  EXCESS_BILLING: "#a855f7", NEW_START: "#06b6d4", BILLING_PENDING: "#f59e0b",
  PROJECTION_PENDING: "#eab308", PLAY_DATE: "#ec4899", CENTER_WILL_BILL: "#14b8a6",
  DUAL_AGENCY: "#f97316", UNCATEGORIZED: "#94a3b8",
};

type Summary = {
  period: string | null; totalRecords: number;
  totals: { expected: number; actual: number; collected: number; outstanding: number; variance: number; leakage: number; gross: number; agencyBilling: number; copayBilling: number; accuracyPct: number; baselineKids: number };
  actualBreakdown: Record<string, number>;
  byCategory: { category: string; kids: number; variance: number; expected: number; actual: number }[];
  byEntity: { entity: string; kids: number; expected: number; actual: number; variance: number }[];
  byCenter: { center: string; entity: string | null; state: string | null; kids: number; expected: number; actual: number; variance: number }[];
};

export default function DashboardPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    fetch(`/api/billing/summary?${qs}`).then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [filters]);

  const t = data?.totals;
  const actualBars = useMemo(() => {
    const b = data?.actualBreakdown ?? {};
    return [
      { name: "Regular", value: b.regular ?? 0 }, { name: "Agency", value: b.agency ?? 0 },
      { name: "Early/Late", value: b.earlyLate ?? 0 }, { name: "One Time", value: b.oneTime ?? 0 },
      { name: "Other", value: b.other ?? 0 }, { name: "Discount", value: b.discount ?? 0 },
      { name: "Adjustments", value: b.adjustments ?? 0 },
    ];
  }, [data]);

  const flagged = data?.byCategory.filter((c) => c.category !== "MATCHED" && c.category !== "FRACTIONAL_DIFFERENCE").reduce((s, c) => s + c.kids, 0) ?? 0;

  return (
    <PageShell
      title="Executive Dashboard"
      subtitle={data ? `Billing period ${data.period ?? "—"} · ${formatNumber(data.totalRecords)} child-records` : "Loading billing intelligence…"}
      actions={<GhostButton href="/reports/billing" icon={ArrowUpRight}>Open Billing Report</GhostButton>}
    >
      <BillingFilters value={filters} onChange={setFilters} showSearch={false} />

      {loading && <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>}

      {!loading && data && t && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <KpiCard label="Expected Billing" value={formatCurrency(t.expected)} icon={Scale} color={BLUE} sub={`${formatNumber(t.baselineKids)} with a baseline`} />
            <KpiCard label="Actual Billed" value={formatCurrency(t.actual)} icon={DollarSign} color="#22c55e" />
            <KpiCard label="Variance" value={formatCurrency(t.variance)} icon={t.variance >= 0 ? TrendingUp : TrendingDown} color={t.variance >= 0 ? "#3b82f6" : "#a855f7"} tone={t.variance >= 0 ? "up" : "down"} sub="Expected − Actual" />
            <KpiCard label="Collected" value={formatCurrency(t.collected)} icon={CheckCircle2} color="#8b5cf6" />
            <KpiCard label="Outstanding" value={formatCurrency(t.outstanding)} icon={Wallet} color="#f97316" />
            <KpiCard label="Leakage" value={formatCurrency(t.leakage)} icon={TrendingDown} color="#ef4444" tone="down" sub="under-billed total" />
            <KpiCard label="Agency Billed" value={formatCurrency(data.actualBreakdown.agency ?? 0)} icon={Building2} color="#06b6d4" />
            <KpiCard label="Billing Accuracy" value={`${(t.accuracyPct ?? 0).toFixed(1)}%`} icon={Activity} color="#f59e0b" sub="over baseline kids" />
            <KpiCard label="Records" value={formatNumber(data.totalRecords)} icon={Users} color={BLUE} />
            <KpiCard label="Flagged" value={formatNumber(flagged)} icon={AlertTriangle} color="#ef4444" tone="down" sub="≠ Matched" />
          </div>

          {/* Category analysis + actual breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard title="Variance Categories" icon={PieChart} bodyClassName="p-5">
              <div className="space-y-2.5">
                {data.byCategory.map((c) => {
                  const pct = data.totalRecords ? (c.kids / data.totalRecords) * 100 : 0;
                  return (
                    <button key={c.category} onClick={() => setFilters({ ...filters, category: c.category })} className="w-full flex items-center gap-3 group">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm" style={{ background: CAT_COLOR[c.category] ?? "#94a3b8" }} />
                      <span className="text-xs font-medium text-slate-600 w-40 text-left truncate group-hover:text-[#003887]">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: CAT_COLOR[c.category] ?? "#94a3b8" }} />
                      </div>
                      <span className="text-xs font-bold text-slate-800 w-12 text-right">{formatNumber(c.kids)}</span>
                      <span className="text-[11px] text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard title="Actual Billed by Type" icon={BarChart3} bodyClassName="p-5">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={actualBars} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip formatter={((v: number) => formatCurrency(v)) as any} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>{actualBars.map((d) => <Cell key={d.name} fill={d.value < 0 ? "#ef4444" : BLUE} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          {/* Entity rollup */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.byEntity.map((e) => (
              <div key={e.entity} className="bg-gradient-to-br from-white to-slate-50/50 rounded-2xl border border-slate-200/70 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-black tracking-tight text-slate-800">{e.entity}</span>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{formatNumber(e.kids)} kids</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Expected</p><p className="text-xs font-bold text-slate-800 mt-0.5">{formatCurrency(e.expected)}</p></div>
                  <div><p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Actual</p><p className="text-xs font-bold text-slate-800 mt-0.5">{formatCurrency(e.actual)}</p></div>
                  <div><p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Variance</p><p className={`text-xs font-bold mt-0.5 ${e.variance >= 0 ? "text-blue-600" : "text-rose-600"}`}>{formatCurrency(e.variance)}</p></div>
                </div>
              </div>
            ))}
          </div>

          {/* Per-center table */}
          <GlassCard title="Centers by Variance" icon={Building2}
            actions={<a href="/reports/billing" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: BLUE }}>View all records <ArrowUpRight className="w-3 h-3" /></a>}>
            <div className="overflow-x-auto max-h-[440px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80 sticky top-0 backdrop-blur">
                  <tr className="text-slate-400">
                    {["Center", "Entity", "State", "Kids", "Expected", "Actual", "Variance"].map((h) => (
                      <th key={h} className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${["Kids", "Expected", "Actual", "Variance"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.byCenter.map((c) => (
                    <tr key={c.center} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, center: c.center })}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.center}</td>
                      <td className="px-4 py-3 text-slate-500">{c.entity ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{c.state ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatNumber(c.kids)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatCurrency(c.expected)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatCurrency(c.actual)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${c.variance >= 0 ? "text-blue-600" : "text-rose-600"}`}>{formatCurrency(c.variance)}</td>
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
