"use client";

import { useState, useEffect, useCallback } from "react";
import { PageShell, KpiCard, GlassCard } from "@/components/ui/Premium";
import BillingFilters, { Filters, CATEGORY_LABEL } from "@/components/billing/BillingFilters";
import { TrendingDown, AlertTriangle, DollarSign, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

const BLUE = "#003887";
const LEAK_CATS = ["SHORT_BILLING", "BILLING_PENDING", "NEW_START", "PROJECTION_PENDING"];

export default function LeakagePage() {
  const [filters, setFilters] = useState<Filters>({});
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    Promise.all([
      fetch(`/api/billing/summary?${qs}`).then((r) => r.json()),
      fetch(`/api/billing/records?${qs}&pageSize=100&sortBy=variance&sortDir=desc`).then((r) => r.json()),
    ]).then(([s, rec]) => {
      setSummary(s);
      setRows((rec.rows ?? []).filter((r: any) => r.expected > 0 && r.variance > 1));
      setLoading(false);
    });
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const t = summary?.totals;
  const leakKids = (summary?.byCategory?.filter((c: any) => LEAK_CATS.includes(c.category)) ?? []).reduce((s: number, c: any) => s + c.kids, 0);

  return (
    <PageShell title="Revenue Leakage" subtitle="Under-billed — expected but not charged">
      <BillingFilters value={filters} onChange={setFilters} showSearch={false} />
      {loading && <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>}
      {!loading && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Leakage" value={formatCurrency(t.leakage)} icon={TrendingDown} color="#ef4444" tone="down" sub="under-billed only" />
            <KpiCard label="Under-billed Kids" value={formatNumber(leakKids)} icon={AlertTriangle} color="#f97316" />
            <KpiCard label="Expected" value={formatCurrency(t.expected)} icon={DollarSign} color={BLUE} />
            <KpiCard label="Actual" value={formatCurrency(t.actual)} icon={DollarSign} color="#22c55e" />
          </div>

          <GlassCard title="Most Under-billed Records" icon={TrendingDown}
            actions={<a href="/reports/billing?category=SHORT_BILLING" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: BLUE }}>Open in Records <ArrowUpRight className="w-3 h-3" /></a>}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80"><tr className="text-slate-400">
                  {["Child", "Center", "Agency", "Category", "Expected", "Actual", "Leakage"].map((h, i) => <th key={h} className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${i > 3 ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-slate-400">No under-billed records for these filters.</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-rose-50/40 transition-colors">
                      <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.childName}</div><div className="text-[10px] text-slate-400 font-mono">{r.childId}</div></td>
                      <td className="px-4 py-3 text-slate-600">{r.center}</td>
                      <td className="px-4 py-3 text-slate-500">{r.agency ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatCurrency(r.expected)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatCurrency(r.recurringActual ?? r.actual)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">{formatCurrency(r.variance)}</td>
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
