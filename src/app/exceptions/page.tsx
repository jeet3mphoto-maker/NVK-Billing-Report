"use client";

import { useState, useEffect, useCallback } from "react";
import Badge from "@/components/ui/Badge";
import { PageShell, KpiCard, GlassCard } from "@/components/ui/Premium";
import BillingFilters, { Filters, CATEGORY_LABEL } from "@/components/billing/BillingFilters";
import { AlertTriangle, TrendingDown, TrendingUp, CircleSlash, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

const BLUE = "#003887";
const sevVariant: Record<string, "danger" | "warning" | "info" | "gray"> = {
  EXCESS_BILLING: "warning", SHORT_BILLING: "info", BILLING_PENDING: "danger",
  NEW_START: "gray", PROJECTION_PENDING: "gray", DUAL_AGENCY: "warning",
};

export default function ExceptionsPage() {
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
      setRows((rec.rows ?? []).filter((r: any) => r.expected > 0 && r.category !== "MATCHED" && r.category !== "FRACTIONAL_DIFFERENCE"));
      setLoading(false);
    });
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const flaggedKids = summary?.byCategory?.filter((c: any) => !["MATCHED", "FRACTIONAL_DIFFERENCE", "UNCATEGORIZED"].includes(c.category)).reduce((s: number, c: any) => s + c.kids, 0) ?? 0;
  const short = summary?.byCategory?.find((c: any) => c.category === "SHORT_BILLING")?.kids ?? 0;
  const excess = summary?.byCategory?.find((c: any) => c.category === "EXCESS_BILLING")?.kids ?? 0;
  const pending = summary?.byCategory?.find((c: any) => c.category === "BILLING_PENDING")?.kids ?? 0;

  return (
    <PageShell title="Exceptions" subtitle="Every record that needs review">
      <BillingFilters value={filters} onChange={setFilters} showSearch={false} />
      {loading && <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>}
      {!loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Flagged Records" value={formatNumber(flaggedKids)} icon={AlertTriangle} color="#ef4444" tone="down" />
            <KpiCard label="Short Billing" value={formatNumber(short)} icon={TrendingUp} color="#3b82f6" />
            <KpiCard label="Excess Billing" value={formatNumber(excess)} icon={TrendingDown} color="#a855f7" />
            <KpiCard label="Billing Pending" value={formatNumber(pending)} icon={CircleSlash} color="#f59e0b" />
          </div>

          <GlassCard title={`${formatNumber(rows.length)} Exceptions (top by variance)`} icon={AlertTriangle}
            actions={<a href="/reports/billing" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: BLUE }}>Open in Records <ArrowUpRight className="w-3 h-3" /></a>}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80"><tr className="text-slate-400">
                  {["Child", "Center", "Category", "Expected", "Actual", "Variance", "Remark"].map((h, i) => <th key={h} className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${i > 2 && i < 6 ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.childName}</div><div className="text-[10px] text-slate-400 font-mono">{r.childId}</div></td>
                      <td className="px-4 py-3 text-slate-600">{r.center}</td>
                      <td className="px-4 py-3"><Badge variant={sevVariant[r.category] ?? "gray"}>{CATEGORY_LABEL[r.category] ?? r.category}</Badge></td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatCurrency(r.expected)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatCurrency(r.recurringActual ?? r.actual)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${r.variance >= 0 ? "text-blue-600" : "text-rose-600"}`}>{formatCurrency(r.variance)}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{r.remark ?? "—"}</td>
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
