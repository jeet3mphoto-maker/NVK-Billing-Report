"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { Building2, Search } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type Center = {
  id: string; centerId: string; name: string; city: string | null; state: string | null;
  entity: string | null; coreWeeklyFactor: number | null; isActive: boolean;
  _count: { children: number; enrollments: number };
};

export default function CentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/centers").then((r) => r.json()).then((d) => {
      setCenters(Array.isArray(d) ? d : (d.centers ?? [])); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = centers.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.state ?? "").toLowerCase().includes(q.toLowerCase()) || (c.entity ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Centers" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500"><span className="font-semibold text-gray-800">{formatNumber(centers.length)}</span> centers</p>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search center / state / entity…" className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 w-64 focus:outline-none focus:border-[#003887]" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200"><tr className="text-gray-500">
                {["Center", "Center ID", "Entity", "State", "Week Factor", "Children", "Enrollments", "Status"].map((h, i) => <th key={h} className={`px-4 py-2.5 font-semibold ${i >= 4 && i <= 6 ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>}
                {!loading && filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-gray-400" /> {c.name}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-500">{c.centerId}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.entity ?? <span className="text-amber-500">unmapped</span>}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.state ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{c.coreWeeklyFactor ?? "4.33"}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatNumber(c._count?.children ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatNumber(c._count?.enrollments ?? 0)}</td>
                    <td className="px-4 py-2.5"><Badge variant={c.isActive ? "success" : "gray"}>{c.isActive ? "Active" : "Inactive"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
