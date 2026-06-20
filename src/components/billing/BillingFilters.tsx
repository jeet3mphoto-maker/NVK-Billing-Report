"use client";

import { useEffect, useState } from "react";
import { Filter, Search, X } from "lucide-react";

export type Filters = {
  period?: string; entity?: string; state?: string; center?: string;
  status?: string; category?: string; agency?: string; q?: string;
};

type Options = { entities: string[]; states: string[]; centers: string[]; periods: string[]; categories: string[]; agencies: string[] };

const LABEL: Record<string, string> = {
  MATCHED: "Matched", FRACTIONAL_DIFFERENCE: "Fractional Difference", SHORT_BILLING: "Short Billing",
  EXCESS_BILLING: "Excess Billing", NEW_START: "New Start", BILLING_PENDING: "Billing Pending",
  PROJECTION_PENDING: "Projection Pending", PLAY_DATE: "Play Date", CENTER_WILL_BILL: "Center Will Bill",
  DUAL_AGENCY: "Dual Agency", UNCATEGORIZED: "Uncategorized",
};

function Select({ label, value, options, onChange, fmt }: {
  label: string; value: string | undefined; options: string[]; onChange: (v: string) => void; fmt?: (v: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-slate-200/80 rounded-xl px-3 py-2 bg-white/80 text-slate-700 font-medium min-w-[120px] shadow-sm focus:outline-none focus:border-[#003887] focus:ring-2 focus:ring-[#003887]/20 transition-all"
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{fmt ? fmt(o) : o}</option>)}
      </select>
    </div>
  );
}

export default function BillingFilters({ value, onChange, showSearch = true }: {
  value: Filters; onChange: (f: Filters) => void; showSearch?: boolean;
}) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [search, setSearch] = useState(value.q ?? "");

  useEffect(() => {
    fetch("/api/billing/summary", { method: "POST" }).then((r) => r.json()).then(setOpts).catch(() => {});
  }, []);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const active = Object.entries(value).filter(([k, v]) => v && k !== "q").length;

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-4 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[#003887] mr-1 self-center">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100"><Filter className="w-4 h-4" /></div>
          <span className="text-xs font-bold">Filters</span>
        </div>
        <Select label="Period" value={value.period} options={opts?.periods ?? []} onChange={(v) => set({ period: v })} />
        <Select label="Entity" value={value.entity} options={opts?.entities ?? []} onChange={(v) => set({ entity: v })} />
        <Select label="State" value={value.state} options={opts?.states ?? []} onChange={(v) => set({ state: v })} />
        <Select label="Center" value={value.center} options={opts?.centers ?? []} onChange={(v) => set({ center: v })} />
        <Select label="Category" value={value.category} options={opts?.categories ?? []} onChange={(v) => set({ category: v })} fmt={(v) => LABEL[v] ?? v} />
        <Select label="Agency" value={value.agency} options={opts?.agencies ?? []} onChange={(v) => set({ agency: v })} />

        {showSearch && (
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Search child</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") set({ q: search }); }}
                onBlur={() => set({ q: search })}
                placeholder="Name or Child ID…"
                className="w-full text-xs border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-[#003887] focus:ring-1 focus:ring-[#003887]"
              />
            </div>
          </div>
        )}

        {active > 0 && (
          <button
            onClick={() => { setSearch(""); onChange({ period: value.period }); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1.5 self-end"
          >
            <X className="w-3.5 h-3.5" /> Clear ({active})
          </button>
        )}
      </div>
    </div>
  );
}

export { LABEL as CATEGORY_LABEL };
