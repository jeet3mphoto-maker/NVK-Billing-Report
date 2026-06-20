"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { GitCompare, Calendar, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { formatDate, formatNumber, cn } from "@/lib/utils";

const changeVariant: Record<string, "success" | "danger" | "info"> = {
  NEW_CHILD: "success", REMOVED_CHILD: "danger", FIELD_CHANGED: "info",
};

type Row = { id: string; childId: string; childName: string; field: string; oldValue: string | null; newValue: string | null; type: string; date: string };

export default function ChangesPage() {
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: Row[]; summary: any; totalPages: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/changes?type=${filter}&page=${page}&pageSize=50`).then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [filter, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter]);

  const s = data?.summary ?? { newChildren: 0, removedChildren: 0, fieldChanges: 0 };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 relative">
      {/* Subtle background ambient glow */}
      <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[100px] pointer-events-none" />

      <Header title="FC28 Change Tracking" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />
      <div className="p-6 space-y-6 relative z-10 max-w-[1600px] mx-auto w-full">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "New Children", count: s.newChildren, color: "#10b981", bg: "bg-emerald-500/10" },
            { label: "Removed Children", count: s.removedChildren, color: "#f43f5e", bg: "bg-rose-500/10" },
            { label: "Field Changes", count: s.fieldChanges, color: "#003887", bg: "bg-blue-500/10" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm transition-all duration-300 hover:border-blue-300 hover:shadow-md relative overflow-hidden flex items-center justify-between">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ background: c.color }} />
              <div className="pl-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{c.label}</div>
                <div className="text-[22px] font-black tracking-tight text-slate-800">{formatNumber(c.count)}</div>
              </div>
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border", c.bg)}>
                 <Activity className="w-5 h-5" style={{ color: c.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {["ALL", "NEW_CHILD", "REMOVED_CHILD", "FIELD_CHANGED"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm border",
                filter === f ? "text-white border-transparent shadow-md" : "bg-white/70 backdrop-blur-md border-white/50 text-gray-600 hover:bg-white"
              )}
              style={filter === f ? { background: "#003887" } : {}}>
              {f.replace("_", " ")}
            </button>
          ))}
          <span className="ml-auto text-xs font-medium text-gray-400">{formatNumber(data?.total ?? 0)} changes detected</span>
        </div>

        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="px-6 py-5 border-b border-white/40 flex items-center gap-3 bg-white/40">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
              <GitCompare className="w-4 h-4 text-[#003887]" />
            </div>
            <span className="text-base font-bold text-gray-800">Change Log</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100/50">
                  {["Date", "Child ID", "Child Name", "Change Type", "Field", "Previous Value", "New Value"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50/50">
                {loading && <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading changes...</td></tr>}
                {!loading && (data?.rows.length ?? 0) === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No changes found for this filter.</td></tr>}
                {!loading && data?.rows.map((change) => (
                  <tr key={change.id} className="hover:bg-white/80 transition-colors">
                    <td className="px-6 py-3.5 text-gray-500 flex items-center gap-2 text-xs"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {formatDate(change.date)}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-[#003887] bg-blue-50/30">{change.childId}</td>
                    <td className="px-6 py-3.5 font-semibold text-gray-800">{change.childName}</td>
                    <td className="px-6 py-3.5"><Badge variant={changeVariant[change.type]}>{change.type.replace("_", " ")}</Badge></td>
                    <td className="px-6 py-3.5 text-gray-700 font-medium">{change.field}</td>
                    <td className="px-6 py-3.5 text-rose-600 line-through decoration-rose-300 opacity-80">{change.oldValue ?? "—"}</td>
                    <td className="px-6 py-3.5 text-emerald-700 font-medium bg-emerald-50/30">{change.newValue ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/40 bg-white/30">
            <span className="text-xs font-medium text-gray-500">Page {page} of {data?.totalPages ?? 1}</span>
            <div className="flex items-center gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded-xl border border-white shadow-sm disabled:opacity-40 hover:border-[#003887]/30 bg-white hover:text-[#003887] transition-all"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-xl border border-white shadow-sm disabled:opacity-40 hover:border-[#003887]/30 bg-white hover:text-[#003887] transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
