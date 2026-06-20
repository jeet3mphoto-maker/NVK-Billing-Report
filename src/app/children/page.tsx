"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { PageShell, GlassCard } from "@/components/ui/Premium";
import { Search, Users, ChevronRight } from "lucide-react";

interface Child {
  id: string; childId: string; fullName: string;
  familyId: string; centerId: string;
  center?: { name: string };
  family?: { familyId: string };
  isActive: boolean;
  _count?: { enrollments: number; transactions: number };
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Child | null>(null);

  useEffect(() => {
    fetch(`/api/children?q=${encodeURIComponent(search)}&limit=50`)
      .then((r) => r.json())
      .then((d) => { setChildren(d.children ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search]);

  return (
    <PageShell title="Children 360°" subtitle={`${children.length} children`}>
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by child name, ID, or family…"
          className="w-full pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur border border-slate-200/70 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003887]/25 focus:border-[#003887]"
        />
      </div>

      {/* Table */}
      <GlassCard title="All Children" icon={Users}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80">
              <tr className="text-slate-400">
                {["Child ID","Name","Family ID","Center","Enrollments","Transactions","Status",""].map((h, i) => (
                  <th key={h} className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${i >= 4 && i <= 5 ? "text-center" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && children.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No children found. Upload FC28 data to populate.</td></tr>
              )}
              {children.map((child) => (
                <tr key={child.id} className="hover:bg-blue-50/40 transition-colors cursor-pointer" onClick={() => setSelected(child)}>
                  <td className="px-4 py-3 font-mono text-[#003887]">{child.childId}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{child.fullName}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono">{child.family?.familyId ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{child.center?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-600">{child._count?.enrollments ?? 0}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-600">{child._count?.transactions ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={child.isActive ? "success" : "gray"}>{child.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

        {/* Child detail panel */}
        {selected && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: "#003887" }}>
              <div>
                <h2 className="text-white font-bold">{selected.fullName}</h2>
                <p className="text-blue-200 text-xs">ID: {selected.childId}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-blue-200 hover:text-white text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Family ID", value: selected.family?.familyId ?? "—" },
                  { label: "Center", value: selected.center?.name ?? "—" },
                  { label: "Status", value: selected.isActive ? "Active" : "Inactive" },
                ].map((f) => (
                  <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{f.label}</div>
                    <div className="text-sm font-semibold text-gray-800 mt-0.5">{f.value}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {["Enrollment History", "Billing History", "Payments", "Rate Changes", "Timeline"].map((tab) => (
                  <button key={tab} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm text-gray-700 transition-colors">
                    <span>{tab}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
    </PageShell>
  );
}
