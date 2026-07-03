"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, Search, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, XCircle, Download } from "lucide-react";

interface AgencyRow {
  id: string;
  center: string | null;
  active: string | null;
  contractPeriod: string | null;
  name: string | null;
  type: string | null;
  useBlackoutDates: string | null;
  discountsPermitted: string | null;
}

interface BatchInfo {
  id: string;
  uploadedAt: string;
  fileCount: number;
  rowCount: number;
}

const PAGE_SIZE = 100;

export default function AgencySettingsPage() {
  const [rows,    setRows]    = useState<AgencyRow[]>([]);
  const [batch,   setBatch]   = useState<BatchInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agency-settings?all=1");
      const j   = await res.json();
      setRows(j.rows ?? []);
      setBatch(j.batch ?? null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(s) ||
      r.center?.toLowerCase().includes(s) ||
      r.type?.toLowerCase().includes(s) ||
      r.contractPeriod?.toLowerCase().includes(s)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Agency Settings</h1>
            <p className="text-sm text-slate-500">Agency data loaded from the Agencies sheet in Rate Sheet files</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/agency-settings/download"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </a>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Batch info */}
      {batch ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>
            <strong>{batch.rowCount.toLocaleString()} rows</strong> from{" "}
            <strong>{batch.fileCount} Rate Sheet file(s)</strong> — uploaded{" "}
            {new Date(batch.uploadedAt).toLocaleString("en-IN")}
          </span>
        </div>
      ) : !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          No agency data found. Upload Rate Sheet files that include an <strong>Agencies</strong> sheet.
        </div>
      )}

      {/* Search + stats */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search name, center, type…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <span className="text-sm text-slate-400">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} rows
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin" /> Loading…
          </div>
        ) : paged.length === 0 ? (
          <div className="p-16 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-semibold">No agency records{search ? " matching your search" : ""}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Name","Center","Active","Contract Period","Type","Use Blackout Dates","Discounts Permitted"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 1 ? "bg-slate-50/40" : ""}>
                      <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{r.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{r.center ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {r.active?.toLowerCase() === "yes" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3" /> Yes
                          </span>
                        ) : r.active?.toLowerCase() === "no" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            <XCircle className="w-3 h-3" /> No
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{r.contractPeriod ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.type ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.useBlackoutDates ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.discountsPermitted ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-400">
                  Page {page} of {totalPages} · {filtered.length.toLocaleString()} rows
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
