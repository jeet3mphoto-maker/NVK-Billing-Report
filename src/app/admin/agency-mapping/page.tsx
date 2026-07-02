"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import { RefreshCw, Save, Trash2, Building2, ChevronDown, X } from "lucide-react";

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-300 ${value ? "border-slate-200 text-slate-800" : "border-slate-200 text-slate-400"}`}
      >
        <span className="truncate">{value || "Select agency name…"}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agency…"
              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Clear */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear selection
            </button>
          )}

          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">No agencies found in Agency Settings</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 ${value === opt ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}
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

  const loadOptions = useCallback(async () => {
    const res = await fetch("/api/agency-settings");
    const j   = await res.json();
    setOptions(j.names ?? []);
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

  useEffect(() => {
    loadOptions();
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/agency-name-mapping/sync", { method: "POST" });
      const j   = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Sync failed");
      setSyncMsg(`Synced — ${j.added} new agency name(s) added, ${j.skipped} already existed`);
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
  };

  const unmapped = mappings.filter(m => !m.agencySettingName).length;
  const mapped   = mappings.length - unmapped;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header title="Agency Name Mapping" />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                FC28 Agency Name → Agency Settings Name
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Map each agency name from FC28 (Agency 1 / Agency 2 columns) to the
                canonical name from the Agencies sheet in your Rate Sheet files.
              </p>
            </div>
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from FC28"}
            </button>
          </div>

          {syncMsg && (
            <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${syncMsg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {syncMsg}
            </p>
          )}

          {options.length === 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              No agency names loaded from Agency Settings yet. Upload Rate Sheet files that include an <strong>Agencies</strong> sheet to populate the dropdown.
            </div>
          )}

          {mappings.length > 0 && (
            <div className="mt-4 flex gap-4 text-sm">
              <span className="text-green-700 font-medium">{mapped} mapped</span>
              <span className="text-amber-600 font-medium">{unmapped} unmapped</span>
              <span className="text-slate-500">{mappings.length} total</span>
            </div>
          )}
        </div>

        {/* Mapping table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
          ) : mappings.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 font-medium">No agency mappings yet</p>
              <p className="text-slate-400 text-sm mt-1">
                Click "Sync from FC28" to pull agency names from the latest FC28 upload.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-5/12">FC28 Agency Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-5/12">Agency Settings Name</th>
                  <th className="px-4 py-3 w-2/12"></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, i) => {
                  const dirty = edits[m.id] !== (m.agencySettingName ?? "");
                  return (
                    <tr key={m.id} className={`border-b border-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${m.agencySettingName ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-700"}`}>
                          {m.fc28AgencyName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <AgencyDropdown
                          value={edits[m.id] ?? ""}
                          options={options}
                          onChange={v => setEdits(prev => ({ ...prev, [m.id]: v }))}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          {dirty && (
                            <button
                              onClick={() => save(m.id)}
                              disabled={saving[m.id]}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Save className="w-3 h-3" />
                              {saving[m.id] ? "…" : "Save"}
                            </button>
                          )}
                          <button
                            onClick={() => remove(m.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center">
          Agency names are pulled from the <strong>Agency 1</strong> and <strong>Agency 2</strong> columns of the latest FC28 upload.
          Upload Rate Sheet files containing an <strong>Agencies</strong> sheet to populate the dropdown.
        </p>
      </main>
    </div>
  );
}
