"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Save, Trash2, Building2, ChevronDown, X, Search, AlertCircle, CheckCircle2 } from "lucide-react";

interface Mapping {
  id: string;
  fc28AgencyName: string;
  agencySettingName: string | null;
}

function AgencyDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o =>
    !search || o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
          open ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"
        } ${value ? "text-slate-800 bg-white" : "text-slate-400 bg-white"}`}
      >
        <span className="truncate pr-2">{value || "Select agency…"}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agencies…"
              className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700 placeholder-slate-400"
            />
          </div>

          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b border-slate-100 flex items-center gap-1.5"
            >
              <X className="w-3 h-3" /> Clear selection
            </button>
          )}

          <div className="max-h-52 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <AlertCircle className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                <p className="text-xs text-slate-500">No agencies in Agency Settings</p>
                <p className="text-xs text-slate-400 mt-0.5">Re-upload Rate Sheet files with an Agencies sheet</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">No match for "{search}"</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                    value === opt ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgencyMappingPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [syncing,  setSyncing]  = useState(false);
  const [edits,    setEdits]    = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState<Record<string, boolean>>({});
  const [syncMsg,  setSyncMsg]  = useState("");
  const [options,  setOptions]  = useState<string[]>([]);
  const [agencyBatch, setAgencyBatch] = useState<any>(null);

  const loadOptions = useCallback(async () => {
    const res = await fetch("/api/agency-settings");
    const j   = await res.json();
    setOptions(j.names ?? []);
    setAgencyBatch(j.batch ?? null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/agency-name-mapping");
      const j    = await res.json();
      const list: Mapping[] = j.mappings ?? [];
      setMappings(list);
      const init: Record<string, string> = {};
      for (const m of list) init[m.id] = m.agencySettingName ?? "";
      setEdits(init);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOptions(); load(); }, []);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/agency-name-mapping/sync", { method: "POST" });
      const j   = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Sync failed");
      setSyncMsg(`✓ ${j.added} new agency name(s) added, ${j.skipped} already existed`);
      await load();
    } catch (e: any) {
      setSyncMsg(`Error: ${e.message}`);
    } finally { setSyncing(false); }
  };

  const save = async (id: string) => {
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/agency-name-mapping/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ agencySettingName: edits[id] }),
      });
      setMappings(prev =>
        prev.map(m => m.id === id ? { ...m, agencySettingName: edits[id] || null } : m)
      );
    } finally { setSaving(prev => ({ ...prev, [id]: false })); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this agency name mapping?")) return;
    await fetch(`/api/agency-name-mapping/${id}`, { method: "DELETE" });
    setMappings(prev => prev.filter(m => m.id !== id));
    setEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const unmapped = mappings.filter(m => !m.agencySettingName).length;
  const mapped   = mappings.length - unmapped;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agency Name Mapping</h1>
          <p className="text-sm text-slate-500">Map FC28 agency names to canonical names from the Agencies sheet</p>
        </div>
      </div>

      {/* Agency Settings status */}
      {agencyBatch ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>
            Agency Settings loaded — <strong>{agencyBatch.rowCount} rows</strong> from{" "}
            <strong>{agencyBatch.fileCount} file(s)</strong>, uploaded{" "}
            {new Date(agencyBatch.uploadedAt).toLocaleString("en-IN")}.{" "}
            <strong>{options.length} unique agency names</strong> available in dropdown.
          </span>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span>
            No Agency Settings data yet. Go to <strong>Rate Sheet</strong> and re-upload your
            center Excel files — each file must contain an <strong>"Agencies"</strong> sheet
            with columns: Center, Active, Contract Period, Name, Type, Use Blackout Dates, Discounts Permitted.
          </span>
        </div>
      )}

      {/* Stats + Sync bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          {mappings.length > 0 ? (
            <div className="flex items-center gap-5 text-sm">
              <span className="flex items-center gap-1.5 text-green-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {mapped} mapped
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                {unmapped} unmapped
              </span>
              <span className="text-slate-400">{mappings.length} total</span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No agency names synced yet.</p>
          )}
          <p className="text-xs text-slate-400">
            Pull unique Agency 1 / Agency 2 values from the latest FC28 upload
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from FC28"}
        </button>
      </div>

      {syncMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${syncMsg.startsWith("Error") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {syncMsg}
        </div>
      )}

      {/* Mapping table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin" />
            Loading mappings…
          </div>
        ) : mappings.length === 0 ? (
          <div className="p-16 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-600 font-semibold">No agency mappings yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Click <strong>Sync from FC28</strong> to pull agency names from the latest FC28 upload.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-0 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <div className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">FC28 Agency Name</div>
              <div className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Agency Settings Name</div>
              <div className="px-5 py-3 w-20" />
            </div>

            <div className="divide-y divide-slate-50">
              {mappings.map((m, i) => {
                const dirty   = edits[m.id] !== (m.agencySettingName ?? "");
                const isMapped = !!(m.agencySettingName);
                return (
                  <div
                    key={m.id}
                    className={`grid grid-cols-[1fr_1fr_auto] gap-0 items-center ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}
                  >
                    {/* FC28 name */}
                    <div className="px-5 py-3 min-w-0">
                      <span className={`inline-block max-w-full truncate px-2.5 py-1 rounded-lg text-xs font-medium font-mono ${
                        isMapped ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-700"
                      }`} title={m.fc28AgencyName}>
                        {m.fc28AgencyName}
                      </span>
                    </div>

                    {/* Dropdown */}
                    <div className="px-5 py-2.5 min-w-0">
                      <AgencyDropdown
                        value={edits[m.id] ?? ""}
                        options={options}
                        onChange={v => setEdits(prev => ({ ...prev, [m.id]: v }))}
                      />
                    </div>

                    {/* Actions */}
                    <div className="px-3 py-2.5 w-20 flex items-center gap-1 justify-end">
                      {dirty && (
                        <button
                          onClick={() => save(m.id)}
                          disabled={saving[m.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          <Save className="w-3 h-3" />
                          {saving[m.id] ? "…" : "Save"}
                        </button>
                      )}
                      <button
                        onClick={() => remove(m.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remove mapping"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
