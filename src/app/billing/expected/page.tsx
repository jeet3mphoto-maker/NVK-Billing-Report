"use client";

import { useState, useEffect, useCallback } from "react";
import { PageShell, KpiCard, GlassCard } from "@/components/ui/Premium";
import BillingFilters, { Filters } from "@/components/billing/BillingFilters";
import { Scale, Building2, HandCoins, Wallet, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

const BLUE = "#003887";

export default function ExpectedBillingPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    Promise.all([
      fetch(`/api/billing/summary?${qs}`).then((r) => r.json()),
      fetch(`/api/billing/records?${qs}&pageSize=50&sortBy=expected&sortDir=desc`).then((r) => r.json()),
    ]).then(([s, rec]) => { setSummary(s); setRows(rec.rows ?? []); setLoading(false); });
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const t = summary?.totals;
  return (
    <PageShell title="Expected Billing" subtitle="What should be billed — Rate Card × FC28">
      <BillingFilters value={filters} onChange={setFilters} showSearch={false} />
      {loading && <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>}
      {!loading && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Expected" value={formatCurrency(t.expected)} icon={Scale} color={BLUE} sub={`${formatNumber(t.baselineKids)} with a baseline`} />
            <KpiCard label="Gross (Rate Card)" value={formatCurrency(t.gross)} icon={Building2} color="#06b6d4" />
            <KpiCard label="Agency Billing" value={formatCurrency(t.agencyBilling)} icon={HandCoins} color="#8b5cf6" />
            <KpiCard label="Copay Billing" value={formatCurrency(t.copayBilling)} icon={Wallet} color="#f59e0b" />
          </div>

          <GlassCard title="Top Expected by Child" icon={Scale}
            actions={<a href="/reports/billing" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: BLUE }}>All records <ArrowUpRight className="w-3 h-3" /></a>}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80"><tr className="text-slate-400">
                  {["Child", "Center", "Agency", "Cycle", "Days", "Gross", "Expected"].map((h, i) => <th key={h} className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${i > 3 ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.filter((r) => r.expected > 0).map((r) => (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.childName}</div><div className="text-[10px] text-slate-400 font-mono">{r.childId}</div></td>
                      <td className="px-4 py-3 text-slate-600">{r.center}</td>
                      <td className="px-4 py-3 text-slate-500">{r.agency ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{r.billingCycle ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-500 font-mono">{r.daysBilled}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">{r.gross ? formatCurrency(r.gross) : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(r.expected)}</td>
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
