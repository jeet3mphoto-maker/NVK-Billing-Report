"use client";

import { useState, useEffect, useCallback } from "react";
import { PageShell, KpiCard, GlassCard } from "@/components/ui/Premium";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  HelpCircle,
  Play,
  Download,
  History,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
} from "lucide-react";

const BLUE = "#003887";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  MATCHED:       { label: "Matched",          color: "#16a34a", bg: "#dcfce7" },
  RATE_MISMATCH: { label: "Rate Mismatch",    color: "#ea580c", bg: "#ffedd5" },
  MISSING_FIN14: { label: "Missing in FIN14", color: "#dc2626", bg: "#fee2e2" },
  MISSING_FIN02: { label: "Missing in FIN02", color: "#9333ea", bg: "#f3e8ff" },
  NOT_ENROLLED:  { label: "Not Enrolled",     color: "#64748b", bg: "#f1f5f9" },
  NO_DATA:       { label: "No Data",          color: "#94a3b8", bg: "#f8fafc" },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "#64748b", bg: "#f1f5f9" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${Number(n).toFixed(1)}%`;
}

interface Run {
  id: string;
  billingPeriod: string;
  totalChildren: number;
  matched: number;
  rateMismatch: number;
  missingFin14: number;
  missingFin02: number;
  noData: number;
  notEnrolled: number;
  runAt: string;
}

interface Line {
  id: string;
  childId: string | null;
  familyId: string | null;
  childName: string | null;
  centerName: string | null;
  program: string | null;
  classroom: string | null;
  enrollmentStatus: string | null;
  billingCycle: string | null;
  agencyName: string | null;
  fin02Rate: number | null;
  fin02Frequency: string | null;
  fin02ChargeCode: string | null;
  fin02Description: string | null;
  fin14Amount: number | null;
  fin14TxnCount: number;
  expectedAmount: number | null;
  varianceAmount: number | null;
  variancePercent: number | null;
  reconcStatus: string;
  notes: string | null;
}

interface Fin02Upload {
  id: string;
  fileName: string;
  uploadedAt: string;
  recordsProcessed: number;
  status: string;
}

export default function ReconciliationPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [fin02Uploads, setFin02Uploads] = useState<Fin02Upload[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Run-config form
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [billingPeriod, setBillingPeriod] = useState(currentMonth);
  const [selectedFin02, setSelectedFin02] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);

  // Fetch runs + fin02 uploads on mount
  const fetchMeta = useCallback(() => {
    fetch("/api/reconciliation")
      .then((r) => r.json())
      .then((d) => {
        setRuns(d.runs ?? []);
        setFin02Uploads(d.fin02Uploads ?? []);
        if (d.runs?.length && !selectedRun) {
          loadRun(d.runs[0]);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  function loadRun(run: Run) {
    setSelectedRun(run);
    setLoadingLines(true);
    fetch(`/api/reconciliation/${run.id}`)
      .then((r) => r.json())
      .then((d) => { setLines(d.lines ?? []); setLoadingLines(false); });
  }

  async function runReconciliation() {
    setRunning(true);
    try {
      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPeriod, fin02UploadId: selectedFin02 || undefined }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      await fetchMeta();
      // Load the new run
      const newRun: Run = {
        id: data.id,
        billingPeriod: data.billingPeriod,
        totalChildren: data.totalChildren,
        matched: data.matched,
        rateMismatch: data.rateMismatch,
        missingFin14: data.missingFin14,
        missingFin02: data.missingFin02,
        noData: data.noData,
        notEnrolled: data.notEnrolled,
        runAt: new Date().toISOString(),
      };
      loadRun(newRun);
    } finally {
      setRunning(false);
    }
  }

  const filteredLines = lines.filter((l) => {
    if (statusFilter !== "ALL" && l.reconcStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.childName?.toLowerCase().includes(q) ||
        l.childId?.toLowerCase().includes(q) ||
        l.familyId?.toLowerCase().includes(q) ||
        l.centerName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const matchPct = selectedRun && selectedRun.totalChildren > 0
    ? ((selectedRun.matched / selectedRun.totalChildren) * 100).toFixed(1)
    : "0";

  return (
    <PageShell
      title="FIN02 × FIN14 × FC28 Reconciliation"
      subtitle="Compare rate masters (FIN02) against actual transactions (FIN14) using enrollment data (FC28)"
    >
      {/* ── Run Configuration ──────────────────────────────────────────────── */}
      <GlassCard title="Run Reconciliation" icon={Play}>
        <div className="flex flex-wrap items-end gap-4 p-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing Period</label>
            <input
              type="month"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">FIN02 Rate Master</label>
            <select
              value={selectedFin02}
              onChange={(e) => setSelectedFin02(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Latest uploaded FIN02</option>
              {fin02Uploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fileName} ({u.recordsProcessed} rates · {new Date(u.uploadedAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={runReconciliation}
            disabled={running}
            className="flex items-center gap-2 px-6 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition hover:opacity-90"
            style={{ background: BLUE }}
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running…" : "Run Reconciliation"}
          </button>

          {selectedRun && (
            <a
              href={`/api/reconciliation/${selectedRun.id}?export=1`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </a>
          )}
        </div>

        {fin02Uploads.length === 0 && (
          <div className="mt-3 mx-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            No FIN02 Rate Master uploaded yet. Go to <strong className="mx-1">File Upload Center</strong> to upload a FIN02 file before running reconciliation.
          </div>
        )}
      </GlassCard>

      {/* ── KPI Summary ────────────────────────────────────────────────────── */}
      {selectedRun && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              label="Total Children"
              value={selectedRun.totalChildren.toString()}
              icon={Scale}
              color={BLUE}
              sub={`Period: ${selectedRun.billingPeriod}`}
            />
            <KpiCard
              label="Matched"
              value={`${matchPct}%`}
              icon={CheckCircle2}
              color="#16a34a"
              sub={`${selectedRun.matched} children`}
            />
            <KpiCard
              label="Rate Mismatch"
              value={selectedRun.rateMismatch.toString()}
              icon={AlertTriangle}
              color="#ea580c"
              sub="FIN02 ≠ FIN14"
            />
            <KpiCard
              label="Missing FIN14"
              value={selectedRun.missingFin14.toString()}
              icon={XCircle}
              color="#dc2626"
              sub="Enrolled but not billed"
            />
            <KpiCard
              label="Missing FIN02"
              value={selectedRun.missingFin02.toString()}
              icon={MinusCircle}
              color="#9333ea"
              sub="No rate master entry"
            />
            <KpiCard
              label="Not Enrolled"
              value={selectedRun.notEnrolled.toString()}
              icon={HelpCircle}
              color="#64748b"
              sub="Billed but not in FC28"
            />
          </div>

          {/* ── Reconciliation History ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-400" />
                Reconciliation History ({runs.length} runs)
              </span>
              {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showHistory && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Period", "Run At", "Total", "Matched", "Mismatch", "Missing FIN14", "Missing FIN02", ""].map(
                        (h, i) => (
                          <th key={i} className={`px-4 py-2 font-semibold text-gray-500 ${i > 1 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        className={`cursor-pointer transition-colors hover:bg-blue-50/40 ${selectedRun?.id === run.id ? "bg-blue-50" : ""}`}
                        onClick={() => loadRun(run)}
                      >
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{run.billingPeriod}</td>
                        <td className="px-4 py-2.5 text-slate-500">{new Date(run.runAt).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{run.totalChildren}</td>
                        <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{run.matched}</td>
                        <td className="px-4 py-2.5 text-right text-orange-600">{run.rateMismatch}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{run.missingFin14}</td>
                        <td className="px-4 py-2.5 text-right text-purple-600">{run.missingFin02}</td>
                        <td className="px-4 py-2.5">
                          {selectedRun?.id === run.id && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">ACTIVE</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Results Table ───────────────────────────────────────────────── */}
          <GlassCard
            title={`Results — ${selectedRun.billingPeriod}`}
            icon={Scale}
            actions={
              <span className="text-xs text-slate-400">
                {filteredLines.length} of {lines.length} rows
              </span>
            }
          >
            {/* Filters bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Status filter tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                {["ALL", "MATCHED", "RATE_MISMATCH", "MISSING_FIN14", "MISSING_FIN02", "NOT_ENROLLED", "NO_DATA"].map(
                  (s) => {
                    const m = s === "ALL" ? null : STATUS_META[s];
                    const count =
                      s === "ALL"
                        ? lines.length
                        : lines.filter((l) => l.reconcStatus === s).length;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                          statusFilter === s
                            ? "border-current shadow-sm"
                            : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100"
                        }`}
                        style={
                          statusFilter === s && m
                            ? { color: m.color, background: m.bg, borderColor: m.color + "40" }
                            : statusFilter === s
                            ? { color: BLUE, background: "#eff6ff", borderColor: BLUE + "40" }
                            : {}
                        }
                      >
                        {m?.label ?? "All"} ({count})
                      </button>
                    );
                  }
                )}
              </div>

              {/* Search */}
              <div className="ml-auto flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search child / center…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs outline-none w-40 bg-transparent"
                />
              </div>
            </div>

            {loadingLines ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading results…</div>
            ) : filteredLines.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No results match your filters.</div>
            ) : (
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-xs min-w-[1100px]">
                  <thead className="bg-slate-50/80 sticky top-0 backdrop-blur z-10">
                    <tr className="text-slate-400">
                      {[
                        { label: "Status",          right: false },
                        { label: "Child Name",       right: false },
                        { label: "Child ID",         right: false },
                        { label: "Center",           right: false },
                        { label: "Program / Class",  right: false },
                        { label: "Agency",           right: false },
                        { label: "FIN02 Item",       right: false },
                        { label: "FIN02 Gross",      right: true },
                        { label: "Expected (Net)",   right: true },
                        { label: "FIN14 Actual",     right: true },
                        { label: "# Txns",           right: true },
                        { label: "Variance",         right: true },
                        { label: "Var %",            right: true },
                      ].map(({ label, right }) => (
                        <th
                          key={label}
                          className={`px-3 py-2.5 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap ${
                            right ? "text-right" : "text-left"
                          }`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLines.map((l) => {
                      const varColor =
                        l.varianceAmount == null
                          ? "text-slate-400"
                          : Math.abs(l.varianceAmount) <= 1
                          ? "text-green-600"
                          : l.varianceAmount > 0
                          ? "text-red-600"
                          : "text-orange-600";
                      return (
                        <tr key={l.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <StatusPill status={l.reconcStatus} />
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800 max-w-[160px] truncate">
                            {l.childName ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{l.childId ?? "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[140px] truncate">
                            {l.centerName ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {[l.program, l.classroom].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{l.agencyName ?? "—"}</td>
                          <td className="px-3 py-2.5 text-slate-500 max-w-[160px]" title={l.notes ?? ""}>
                            <span className="truncate block">
                              {l.fin02Description ?? "—"}
                            </span>
                            {l.notes && l.notes.includes("|") && (
                              <span className="text-[10px] text-blue-400">+more</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                            {l.fin02Rate != null ? fmt(l.fin02Rate) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                            {fmt(l.expectedAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                            {fmt(l.fin14Amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{l.fin14TxnCount}</td>
                          <td className={`px-3 py-2.5 text-right font-mono font-semibold ${varColor}`}>
                            {l.varianceAmount != null ? fmt(l.varianceAmount) : "—"}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono ${varColor}`}>
                            {fmtPct(l.variancePercent)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* Empty state — no runs yet */}
      {!selectedRun && !running && (
        <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
          <Scale className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm font-semibold text-slate-500 mb-1">No reconciliation runs yet</p>
          <p className="text-xs max-w-sm">
            Upload a <strong>FIN02</strong> rate master and <strong>FIN14</strong> transactions, then click
            <strong> Run Reconciliation</strong> above.
          </p>
        </div>
      )}
    </PageShell>
  );
}
