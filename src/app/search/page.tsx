"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/Premium";
import { Search, Users } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type Child = {
  id: string; childId: string; fullName: string;
  center: { name: string } | null; family: { familyId: string } | null;
  _count: { enrollments: number; attendance: number; transactions: number };
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/children?q=${encodeURIComponent(q)}&limit=60`).then((r) => r.json())
        .then((d) => { setResults(d.children ?? []); setLoading(false); }).catch(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <PageShell title="Global Search" subtitle="Find any child by name, Child ID, or Family ID">
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by child name, Child ID, or Family ID…"
          className="w-full pl-12 pr-5 py-3.5 text-sm bg-white/80 backdrop-blur border border-slate-200/70 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003887]/25 focus:border-[#003887]"
        />
        {q && <button onClick={() => setQ("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>}
      </div>

      {q.trim().length < 2 && <p className="text-sm text-slate-400">Type at least 2 characters to search your children records.</p>}
      {loading && <p className="text-sm text-slate-400">Searching…</p>}
      {!loading && q.trim().length >= 2 && (
        <p className="text-sm text-slate-500"><span className="font-bold text-slate-800">{formatNumber(results.length)}</span> match{results.length === 1 ? "" : "es"} for “{q}”</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {results.map((c) => (
          <a key={c.childId} href={`/reports/billing?q=${encodeURIComponent(c.childId)}`}
            className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-4 shadow-sm hover:border-[#003887]/30 hover:shadow-md transition-all block">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: "#003887" }}>
                <Users className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{c.fullName}</p>
                <p className="text-xs text-slate-500 font-mono">{c.childId} · {c.center?.name ?? "—"}</p>
                <p className="text-[11px] text-slate-400 mt-1">Family {c.family?.familyId ?? "—"} · {c._count.transactions} txns · {c._count.enrollments} enrollments</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </PageShell>
  );
}
