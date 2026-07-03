"use client";

import { useState, useCallback, useRef } from "react";
import { BarChart3, RefreshCw, GitMerge, Calculator, Download, Search, Trash2, ChevronLeft, ChevronRight, Receipt, Building2 } from "lucide-react";

// ── column ordering ────────────────────────────────────────────────────────
const FC28_ORDER = [
  "Child Status (FC28)","Family Status (FC28)","Classroom (FC28)","Rate Sheet (FC28)",
  "Date of Birth (FC28)","Enroll Date (FC28)","Start Date (FC28)","Withdrawal Date (FC28)",
  "Withdrawal Reason (FC28)","Primary Guardian (FC28)",
  "Mon (FC28)","Tue (FC28)","Wed (FC28)","Thu (FC28)","Fri (FC28)",
  "Drop Off (FC28)","Pickup (FC28)","Early AM Care (FC28)","Late PM Care (FC28)","Program (FC28)",
  "Discount Type (FC28)","Discount Name (FC28)","Main Discount (FC28)","AM/PM Discount (FC28)","Total Discount (FC28)",
  "Billing Cycle (FC28)",
  "Agency 1 (FC28)","Family Contrib 1 (FC28)","Estimated Contract Amount 1 (FC28)","Contract Period 1 (FC28)","Copay Amt 1 (FC28)","Copay Period 1 (FC28)",
  "Agency 2 (FC28)","Family Contrib 2 (FC28)","Estimated Contract Amount 2 (FC28)","Contract Period 2 (FC28)","Copay Amt 2 (FC28)","Copay Period 2 (FC28)",
  "Rate Card Key (FC28)","Revised Classroom (FC28)","Early AM Rate Card Key (FC28)","Late PM Rate Card Key (FC28)",
];
const RATE_SHEET_ORDER = ["Item Name (Rate Sheet)","Item Value (Rate Sheet)","Core Weekly Logic"];
const AGENCY_ORDER = [
  "Agency Name","Estimated Contract Amount",
  "Agency 1 - Revised Agency Name","Agency 1 - Agency Name (Agency)","Agency 1 - Contract Period (Agency)","Agency 1 - Agency Type (Agency)","Agency 1 - Agency Active","Agency 1 - Use Blackout Dates","Agency 1 - Discounts Permitted",
  "Agency 2 - Revised Agency Name","Agency 2 - Agency Name (Agency)","Agency 2 - Contract Period (Agency)","Agency 2 - Agency Type (Agency)","Agency 2 - Agency Active","Agency 2 - Use Blackout Dates","Agency 2 - Discounts Permitted",
];
const CALC_ORDER = [
  "Month Start Date","Month End Date","Total Days in Month","Total Mondays in Month",
  "Final Start Date","Final End Date","Final Days to be Billed","Final Weeks to be Billed",
  "Monthly Fees","Early AM Care Fees","Late PM Care Fees","Program Fees",
  "Gross Billing Amount","Agency Type",
  "Final Billing Amount","Final Agency Billing","Estimated Copay Billing",
  "Agency Billing","Copay Billing","Customer Liability",
  "Final Agency Billing","Final Copay","Final Customer Liability","Final Expected Billing",
];
const KNOWN_SET = new Set([...FC28_ORDER, ...RATE_SHEET_ORDER, ...AGENCY_ORDER, ...CALC_ORDER]);

function sortColumns(cols: string[]): string[] {
  const headCols = cols.filter(c => !KNOWN_SET.has(c)).sort();
  const fc28     = FC28_ORDER.filter(c => cols.includes(c));
  const rs       = RATE_SHEET_ORDER.filter(c => cols.includes(c));
  const agency   = AGENCY_ORDER.filter(c => cols.includes(c));
  const calc     = CALC_ORDER.filter(c => cols.includes(c));
  return [...headCols, ...fc28, ...rs, ...agency, ...calc];
}

// ── types ──────────────────────────────────────────────────────────────────
type Phase = "idle" | "running" | "done" | "error";
interface SSEProgress { phase: string; message?: string; done?: number; total?: number; pct?: number; mapped?: number; unmapped?: number; }
interface Row { id: number; childId: string | null; childName: string | null; center: string | null; centerId: string | null; familyId: string | null; familyName: string | null; rawData: Record<string, any>; }
interface PageData { total: number; page: number; pageSize: number; rows: Row[]; batchId: string | null; }

// ── SSE helper ─────────────────────────────────────────────────────────────
function useSSE() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog]     = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (url: string, body?: object, method = "POST") => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("running");
    setLog([]);

    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop()!;
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const ev: SSEProgress = JSON.parse(line.slice(5).trim());
          const msg = ev.message ?? (ev.done != null ? `${ev.done}/${ev.total} (${ev.pct}%)` : "");
          if (msg) setLog((p) => [...p.slice(-60), msg]);
          if (ev.phase === "complete") setPhase("done");
          if (ev.phase === "error")    { setPhase("error"); }
        }
      }
      setPhase((p) => p === "running" ? "done" : p);
    } catch (e: any) {
      if (e?.name !== "AbortError") { setPhase("error"); setLog((p) => [...p, e.message]); }
    }
  }, []);

  return { phase, log, run };
}

// ── component ──────────────────────────────────────────────────────────────
export default function ExpectedActualPage() {
  // aggregate
  const aggSSE     = useSSE();
  // map fc28
  const mapSSE     = useSSE();
  // map rate sheet
  const mapRSSSE   = useSSE();
  // map agencies
  const mapAgSSE   = useSSE();
  // calculate monthly
  const calcSSE    = useSSE();
  const [monthStart, setMonthStart] = useState("");
  const [monthEnd,   setMonthEnd]   = useState("");

  // table
  const [data,    setData]    = useState<PageData | null>(null);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(false);

  // all rawData keys across the entire batch — sorted in fixed order
  const rawKeys: string[] = sortColumns((data as any)?.allColumns ?? []);
  const FIXED     = ["childId","childName","center","centerId","familyId","familyName"];

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "50" });
      if (s) params.set("search", s);
      const res = await fetch(`/api/child-billing?${params}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [page, search]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); load(1, v); };
  const handlePage   = (p: number) => { setPage(p); load(p, search); };

  const handleAggregate = async () => {
    const res = await aggSSE.run("/api/child-billing/aggregate");
    load(1, search);
  };

  const handleDelete = async () => {
    if (!confirm("Delete all child billing data?")) return;
    await fetch("/api/child-billing", { method: "DELETE" });
    setData(null);
  };

  const totalPages = data ? Math.ceil(data.total / (data.pageSize ?? 50)) : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-blue-700" />
        <h1 className="text-lg font-bold text-gray-800">Expected vs Actual Billing</h1>
        {data?.batchId && (
          <span className="ml-2 text-xs text-gray-400">{data.total.toLocaleString()} children</span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">

        {/* Action row */}
        <div className="flex flex-wrap gap-3 items-end">

          {/* 1. Aggregate */}
          <OperationCard
            title="1. Aggregate FIN14"
            description="Group flagged transactions by Child → pivot MajorHead/SubHead"
            icon={<RefreshCw className="w-4 h-4" />}
            phase={aggSSE.phase}
            log={aggSSE.log}
            onRun={() => { aggSSE.run("/api/child-billing/aggregate").then(() => load(1, search)); }}
          />

          {/* 2. Map FC28 */}
          <OperationCard
            title="2. Map FC28"
            description="Merge FC28 enrollment fields into each child row"
            icon={<GitMerge className="w-4 h-4" />}
            phase={mapSSE.phase}
            log={mapSSE.log}
            onRun={() => mapSSE.run("/api/child-billing/map-fc28")}
          />

          {/* 3. Map Rate Sheet */}
          <OperationCard
            title="3. Map Rate Sheet"
            description="Look up Rate Card Key → Item Name & Item Value from Rate Sheet"
            icon={<Receipt className="w-4 h-4" />}
            phase={mapRSSSE.phase}
            log={mapRSSSE.log}
            onRun={() => mapRSSSE.run("/api/child-billing/map-rate-sheet")}
          />

          {/* 4. Map Agencies */}
          <OperationCard
            title="4. Map Agencies"
            description="Resolve Agency 1 & 2 via Agency Name Mapping + Agency Settings (name + contract period)"
            icon={<Building2 className="w-4 h-4" />}
            phase={mapAgSSE.phase}
            log={mapAgSSE.log}
            onRun={() => mapAgSSE.run("/api/child-billing/map-agencies")}
          />

          {/* 5. Calculate Monthly */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 w-72">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm text-gray-700">5. Calculate Monthly</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Compute billing amounts for the selected month</p>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide">Month Start</label>
                <input type="date" value={monthStart} onChange={(e) => setMonthStart(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide">Month End</label>
                <input type="date" value={monthEnd} onChange={(e) => setMonthEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5" />
              </div>
            </div>
            <RunButton
              phase={calcSSE.phase}
              disabled={!monthStart || !monthEnd}
              onClick={() => calcSSE.run("/api/child-billing/calculate-monthly", { monthStartDate: monthStart, monthEndDate: monthEnd })}
            />
            <LogPane log={calcSSE.log} phase={calcSSE.phase} />
          </div>

          {/* Download */}
          <div className="flex flex-col gap-2 self-start mt-1">
            <a
              href="/api/child-billing/export"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow transition"
            >
              <Download className="w-4 h-4" />
              Download Excel
            </a>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition"
            >
              <Trash2 className="w-4 h-4" />
              Clear Data
            </button>
          </div>
        </div>

        {/* Search + Load */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search child ID, name, center…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => load(1, search)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load Data"}
          </button>
        </div>

        {/* Table */}
        {data && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[55vh]">
              <table className="text-xs border-collapse w-full min-w-max">
                <thead className="sticky top-0 z-10 bg-blue-900 text-white">
                  <tr>
                    {FIXED.map((k) => (
                      <th key={k} className="px-3 py-2 text-left whitespace-nowrap font-semibold border-r border-blue-800 last:border-r-0">
                        {k === "childId" ? "Child ID" : k === "childName" ? "Child Name" : k === "centerId" ? "Center ID" : k === "familyId" ? "Family ID" : k === "familyName" ? "Family Name" : "Center"}
                      </th>
                    ))}
                    {rawKeys.map((k) => (
                      <th key={k} className="px-3 py-2 text-left whitespace-nowrap font-semibold border-r border-blue-800 last:border-r-0">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{row.childId ?? ""}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{row.childName ?? ""}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{row.center ?? ""}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{row.centerId ?? ""}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{row.familyId ?? ""}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{row.familyName ?? ""}</td>
                      {rawKeys.map((k) => (
                        <td key={k} className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap last:border-r-0">
                          {row.rawData[k] != null ? String(row.rawData[k]) : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              <span>
                {((page - 1) * (data.pageSize ?? 50) + 1).toLocaleString()}–{Math.min(page * (data.pageSize ?? 50), data.total).toLocaleString()} of {data.total.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePage(page - 1)} disabled={page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">Page {page} / {totalPages}</span>
                <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!data && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm">
            <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
            <p>Run <strong>Aggregate FIN14</strong> first, then click <strong>Load Data</strong> to view child-level billing.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── small sub-components ───────────────────────────────────────────────────

function OperationCard({ title, description, icon, phase, log, onRun }: {
  title: string; description: string; icon: React.ReactNode;
  phase: Phase; log: string[]; onRun: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 w-64">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-blue-600">{icon}</span>
        <span className="font-semibold text-sm text-gray-700">{title}</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">{description}</p>
      <RunButton phase={phase} onClick={onRun} />
      <LogPane log={log} phase={phase} />
    </div>
  );
}

function RunButton({ phase, onClick, disabled }: { phase: Phase; onClick: () => void; disabled?: boolean }) {
  const running = phase === "running";
  return (
    <button
      onClick={onClick}
      disabled={running || disabled}
      className={`w-full py-1.5 rounded-lg text-xs font-bold transition ${
        running ? "bg-blue-100 text-blue-400 cursor-wait" :
        phase === "done"  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" :
        phase === "error" ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" :
        "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {running ? "Running…" : phase === "done" ? "✓ Done — Run Again" : phase === "error" ? "✗ Error — Retry" : "Run"}
    </button>
  );
}

function LogPane({ log, phase }: { log: string[]; phase: Phase }) {
  if (!log.length) return null;
  return (
    <div className={`mt-2 rounded text-[10px] p-2 font-mono max-h-20 overflow-y-auto ${
      phase === "error" ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-500"
    }`}>
      {log.slice(-10).map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
