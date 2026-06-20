"use client";

import { useState, useEffect } from "react";
import Badge from "@/components/ui/Badge";
import { PageShell } from "@/components/ui/Premium";
import { Bell, AlertTriangle, TrendingDown, TrendingUp, GitCompare, CircleSlash } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

const BLUE = "#003887";

type Alert = { id: string; icon: any; color: string; severity: "danger" | "warning" | "info" | "gray"; title: string; body: string; href: string };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/summary").then((r) => r.json()),
      fetch("/api/changes?pageSize=1").then((r) => r.json()),
    ]).then(([s, ch]) => {
      const cat = (k: string) => s.byCategory?.find((c: any) => c.category === k) ?? { kids: 0, variance: 0 };
      const list: Alert[] = [];
      const pending = cat("BILLING_PENDING");
      if (pending.kids > 0) list.push({ id: "pending", icon: CircleSlash, color: "#ef4444", severity: "danger", title: `${formatNumber(pending.kids)} children billed nothing (expected > 0)`, body: `${formatCurrency(pending.variance)} of expected billing has no actual charges yet for ${s.period}.`, href: "/reports/billing?category=BILLING_PENDING" });
      const short = cat("SHORT_BILLING");
      if (short.kids > 0) list.push({ id: "short", icon: TrendingUp, color: "#3b82f6", severity: "info", title: `${formatNumber(short.kids)} children short-billed`, body: `Under-billed by ${formatCurrency(short.variance)} vs expected.`, href: "/reports/billing?category=SHORT_BILLING" });
      const excess = cat("EXCESS_BILLING");
      if (excess.kids > 0) list.push({ id: "excess", icon: TrendingDown, color: "#a855f7", severity: "warning", title: `${formatNumber(excess.kids)} children over-billed`, body: `Billed ${formatCurrency(Math.abs(excess.variance))} above expected.`, href: "/reports/billing?category=EXCESS_BILLING" });
      if (s.totals?.leakage > 0) list.push({ id: "leak", icon: AlertTriangle, color: "#f97316", severity: "warning", title: `Revenue leakage: ${formatCurrency(s.totals.leakage)}`, body: `Total under-billing across all centers for ${s.period}.`, href: "/billing/leakage" });
      if (ch.summary?.newChildren > 0) list.push({ id: "new", icon: GitCompare, color: BLUE, severity: "gray", title: `${formatNumber(ch.summary.newChildren)} new children in latest FC28`, body: `New enrollments detected in the most recent FC28 snapshot.`, href: "/changes?type=NEW_CHILD" });
      if (ch.summary?.fieldChanges > 0) list.push({ id: "fld", icon: GitCompare, color: BLUE, severity: "info", title: `${formatNumber(ch.summary.fieldChanges)} FC28 field changes`, body: `Rate / status / program / schedule changes since the last snapshot.`, href: "/changes?type=FIELD_CHANGED" });
      setAlerts(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <PageShell title="Alerts" subtitle={loading ? "Loading…" : `${alerts.length} active alert${alerts.length === 1 ? "" : "s"}`}>
      {!loading && alerts.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-12 text-center text-slate-400 text-sm shadow-sm">
          <Bell className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          No alerts — everything looks reconciled. 🎉
        </div>
      )}
      <div className="space-y-3">
        {alerts.map((a) => {
          const Icon = a.icon;
          return (
            <a key={a.id} href={a.href} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-4 flex items-start gap-4 hover:border-[#003887]/30 hover:shadow-md transition-all shadow-sm block">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: `${a.color}14` }}><Icon className="w-5 h-5" style={{ color: a.color }} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-bold text-slate-800">{a.title}</span><Badge variant={a.severity}>{a.severity === "danger" ? "Critical" : a.severity === "warning" ? "High" : a.severity === "info" ? "Medium" : "Info"}</Badge></div>
                <p className="text-xs text-slate-500 mt-1">{a.body}</p>
              </div>
            </a>
          );
        })}
      </div>
    </PageShell>
  );
}
