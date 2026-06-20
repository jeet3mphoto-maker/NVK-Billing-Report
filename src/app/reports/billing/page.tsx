"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import BillingFilters, { Filters, CATEGORY_LABEL } from "@/components/billing/BillingFilters";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MessageSquarePlus, Download, X, AlertCircle } from "lucide-react";

const BLUE = "#003887";

const CAT_BADGE: Record<string, string> = {
  MATCHED: "bg-green-100 text-green-700 border-green-200", 
  FRACTIONAL_DIFFERENCE: "bg-lime-100 text-lime-700 border-lime-200",
  SHORT_BILLING: "bg-red-100 text-red-700 border-red-200", 
  EXCESS_BILLING: "bg-purple-100 text-purple-700 border-purple-200",
  NEW_START: "bg-cyan-100 text-cyan-700 border-cyan-200", 
  BILLING_PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  PROJECTION_PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200", 
  PLAY_DATE: "bg-pink-100 text-pink-700 border-pink-200",
  CENTER_WILL_BILL: "bg-teal-100 text-teal-700 border-teal-200", 
  DUAL_AGENCY: "bg-orange-100 text-orange-700 border-orange-200",
  UNCATEGORIZED: "bg-gray-100 text-gray-600 border-gray-200",
};
const CATEGORIES = Object.keys(CAT_BADGE);

type Row = {
  id: string; childId: string; childName: string; entity: string | null; state: string | null; center: string;
  status: string | null; agency: string | null; billingCycle: string | null; period: string; daysBilled: number;
  gross: number; expected: number; actual: number; recurringActual: number; regular: number; agencyBilled: number; discount: number;
  earlyLate: number; oneTime: number; other: number; adjustments: number; collected: number;
  variance: number; variancePct: number; category: string; billingStatus: string;
  remark: string | null; detailedRemark: string | null;
};

export default function RecordsPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(page), pageSize: "50", sortBy: "variance", sortDir: "desc" } as any).toString();
    fetch(`/api/billing/records?${qs}`).then((r) => r.json()).then((d) => {
      setRows(d.rows ?? []); setMeta({ total: d.total ?? 0, totalPages: d.totalPages ?? 1 }); setLoading(false);
    }).catch(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);

  const cols = [
    ["Child Details", "left", "w-48"], 
    ["Center Info", "left", "w-40"], 
    ["Status", "left", "w-24"], 
    ["Agency", "left", "w-32"],
    ["Days", "right", "w-16"], 
    ["Gross Base", "right", "w-24"], 
    ["Expected", "right", "w-28 font-bold"],
    ["Actual (Recurring)", "right", "w-28 font-bold"],
    ["Regular", "right", "w-24"], 
    ["Agency $", "right", "w-24"], 
    ["Collected", "right", "w-24"], 
    ["Variance", "right", "w-32 font-black"], 
    ["Category", "left", "w-36"], 
    ["Remark", "left", "w-48"], 
    ["Action", "center", "w-16"],
  ] as const;

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] relative font-sans">
      <Header title="Billing Report" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />

      <div className="p-6 space-y-5 relative z-10 w-full max-w-[1800px] mx-auto flex-1 flex flex-col">
        {/* Top Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Billing Reconciliation</h1>
              <p className="text-sm text-slate-500 mt-1">Compare expected billing against actual transactions to identify revenue leakage.</p>
            </div>
            <a href="/api/billing/export" className="flex items-center gap-2 text-sm font-semibold px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-600 hover:text-blue-700 transition-colors shadow-sm text-slate-700">
              <Download className="w-4 h-4" /> Export to Excel
            </a>
          </div>
          <BillingFilters value={filters} onChange={setFilters} />
        </div>

        {/* Data Grid Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-700">Report Results</h2>
            <div className="text-sm text-slate-500">
              Showing <span className="font-bold text-slate-800">{formatNumber(rows.length)}</span> of <span className="font-bold text-slate-800">{formatNumber(meta.total)}</span> records
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-[13px] whitespace-nowrap border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm border-b border-slate-200">
                <tr className="text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  {cols.map(([h, align, width], i) => (
                    <th key={i} className={`px-4 py-3 border-r border-slate-100 text-${align} ${width} ${i === 0 ? 'sticky left-0 bg-slate-50 shadow-[1px_0_0_rgba(226,232,240,1)] z-30' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td colSpan={cols.length} className="text-center py-16 text-slate-400 font-medium">Loading records...</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={cols.length} className="text-center py-16 text-slate-400 font-medium">No records match the current filters.</td></tr>}
                {!loading && rows.map((r, rowIdx) => {
                  const isFlagged = r.category !== "MATCHED" && r.category !== "FRACTIONAL_DIFFERENCE" && r.expected > 0;
                  const varianceIsNegative = r.variance < 0;
                  const varianceIsPositive = r.variance > 0;
                  
                  return (
                    <tr key={r.id} className={`hover:bg-blue-50/50 transition-colors ${isFlagged ? "bg-red-50/30" : rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                      {/* Frozen Column */}
                      <td className={`px-4 py-3 border-r border-slate-100 sticky left-0 z-10 shadow-[1px_0_0_rgba(226,232,240,1)] ${isFlagged ? "bg-red-50/90" : rowIdx % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}>
                        <div className="flex items-center gap-2">
                          {isFlagged && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <div>
                            <div className="font-bold text-slate-800">{r.childName}</div>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">{r.childId}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-700">{r.center}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{r.entity ?? "—"} • {r.state ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100 text-slate-600 font-medium">{r.status ?? "—"}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-slate-600 truncate max-w-[120px]" title={r.agency ?? ""}>{r.agency ?? "—"}</td>
                      
                      <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-500 font-mono">{r.daysBilled}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-500 font-mono">{r.gross ? formatCurrency(r.gross) : "—"}</td>
                      
                      {/* Expected & Actual Focus */}
                      <td className="px-4 py-3 border-r border-slate-100 text-right font-mono font-bold text-slate-800 bg-slate-50/50">{r.expected ? formatCurrency(r.expected) : "—"}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-right font-mono font-bold text-blue-900 bg-blue-50/20" title={`Total billed incl. one-time/other: ${formatCurrency(r.actual)}`}>{formatCurrency(r.recurringActual ?? r.actual)}</td>
                      
                      <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-500 font-mono">{formatCurrency(r.regular)}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-500 font-mono">{formatCurrency(r.agencyBilled)}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-500 font-mono">{formatCurrency(r.collected)}</td>
                      
                      {/* Variance Highlights */}
                      <td className={`px-4 py-3 border-r border-slate-100 text-right font-mono font-black ${r.expected ? (varianceIsPositive ? "text-red-600 bg-red-50/50" : varianceIsNegative ? "text-blue-600 bg-blue-50/50" : "text-slate-400") : "text-slate-300"}`}>
                        {r.expected ? formatCurrency(r.variance) : "—"}
                      </td>
                      
                      <td className="px-4 py-3 border-r border-slate-100">
                        <span className={`px-2.5 py-1 rounded border text-[10px] font-bold tracking-wide uppercase ${CAT_BADGE[r.category] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {CATEGORY_LABEL[r.category] ?? r.category}
                        </span>
                      </td>
                      
                      <td className="px-4 py-3 border-r border-slate-100 max-w-[200px] truncate text-slate-600 font-medium" title={r.remark ?? ""}>
                        {r.remark ?? <span className="text-slate-300 italic">No remark</span>}
                      </td>
                      
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => setEditing(r)} 
                          className="p-1.5 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors shadow-sm" 
                          title="Add / edit comment"
                        >
                          <MessageSquarePlus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-500">Page {page} of {meta.totalPages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 flex items-center gap-1 rounded border border-slate-300 bg-white text-slate-600 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm">
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 flex items-center gap-1 rounded border border-slate-300 bg-white text-slate-600 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {editing && <CommentModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CommentModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [remark, setRemark] = useState(row.remark ?? "");
  const [detailed, setDetailed] = useState(row.detailedRemark ?? "");
  const [category, setCategory] = useState(row.category);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/billing/comment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, remark, detailedRemark: detailed, category, commentBy: "Admin" }),
    });
    setSaving(false); onSaved();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/50 w-full max-w-lg transition-all" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{row.childName}</h3>
            <p className="text-xs text-gray-400">{row.center} · {row.childId} · Variance {formatCurrency(row.variance)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#003887]">
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Remark</label>
            <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Short reason for the variance…" className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#003887]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Detailed Remark</label>
            <textarea value={detailed} onChange={(e) => setDetailed(e.target.value)} rows={3} placeholder="Full explanation / action taken…" className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#003887]" />
          </div>
          <p className="text-[11px] text-gray-400">Comments carry forward to next month for this child.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: BLUE }}>{saving ? "Saving…" : "Save comment"}</button>
        </div>
      </div>
    </div>
  );
}
