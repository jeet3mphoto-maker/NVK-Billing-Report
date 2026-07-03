"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Building, Pencil, Check, X } from "lucide-react";

interface CenterRow {
  id: string;
  centerName: string;
  centerShort: string | null;
  coreWeeks: number | null;
}

export default function CenterMasterPage() {
  const [rows, setRows]         = useState<CenterRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [search, setSearch]     = useState("");
  const [editing, setEditing]   = useState<Set<string>>(new Set());
  const [editAll, setEditAll]   = useState(false);
  const [drafts, setDrafts]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [savedAll, setSavedAll]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/center-master");
      const json = await res.json();
      setRows(json.rows ?? []);
      const init: Record<string, string> = {};
      for (const r of json.rows ?? []) init[r.id] = r.coreWeeks != null ? String(r.coreWeeks) : "";
      setDrafts(init);
      setEditing(new Set());
      setEditAll(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const res  = await fetch("/api/center-master", { method: "POST" });
      const json = await res.json();
      if (json.error) { alert(json.error); return; }
      await load();
    } finally { setSyncing(false); }
  }

  function startEdit(id: string) {
    setEditing(e => new Set([...e, id]));
  }

  function cancelEdit(id: string, original: CenterRow) {
    setDrafts(d => ({ ...d, [id]: original.coreWeeks != null ? String(original.coreWeeks) : "" }));
    setEditing(e => { const n = new Set(e); n.delete(id); return n; });
  }

  async function save(id: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/center-master/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coreWeeks: drafts[id] }),
      });
      if (!res.ok) { const j = await res.json(); alert(j.error); return; }
      setRows(rs => rs.map(r => r.id === id ? { ...r, coreWeeks: drafts[id] ? parseFloat(drafts[id]) : null } : r));
      setEditing(e => { const n = new Set(e); n.delete(id); return n; });
      setSaved(s => ({ ...s, [id]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [id]: false })), 2000);
    } finally { setSaving(null); }
  }

  async function saveAll() {
    setSavingAll(true);
    try {
      await Promise.all(
        rows.map(r =>
          fetch(`/api/center-master/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coreWeeks: drafts[r.id] }),
          })
        )
      );
      setRows(rs => rs.map(r => ({ ...r, coreWeeks: drafts[r.id] ? parseFloat(drafts[r.id]) : null })));
      setEditing(new Set());
      setEditAll(false);
      setSavedAll(true);
      setTimeout(() => setSavedAll(false), 2000);
    } finally { setSavingAll(false); }
  }

  function toggleEditAll() {
    if (editAll) {
      // cancel all — reset drafts to current saved values
      const reset: Record<string, string> = {};
      for (const r of rows) reset[r.id] = r.coreWeeks != null ? String(r.coreWeeks) : "";
      setDrafts(reset);
      setEditing(new Set());
      setEditAll(false);
    } else {
      setEditing(new Set(rows.map(r => r.id)));
      setEditAll(true);
    }
  }

  const filtered = rows.filter(r =>
    !search ||
    r.centerName.toLowerCase().includes(search.toLowerCase()) ||
    (r.centerShort ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const isEditing = (id: string) => editAll || editing.has(id);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="w-6 h-6 text-blue-600" /> Center Master
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} centers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={toggleEditAll} disabled={rows.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border disabled:opacity-40 transition-colors ${
              editAll
                ? "border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
                : "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
            }`}>
            {editAll ? <><X className="w-3.5 h-3.5" /> Cancel Edit All</> : <><Pencil className="w-3.5 h-3.5" /> Edit All</>}
          </button>
          {(editAll || editing.size > 0) && (
            <button onClick={saveAll} disabled={savingAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors ${
                savedAll ? "bg-blue-600" : "bg-green-600 hover:bg-green-700"
              }`}>
              <Check className="w-3.5 h-3.5" />
              {savingAll ? "Saving…" : savedAll ? "All Saved" : "Save All"}
            </button>
          )}
          <button onClick={sync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync from FC28"}
          </button>
        </div>
      </div>

      <input
        type="text" placeholder="Search centers…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 w-8">#</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Center Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 w-40">Center Short</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 w-36">Core Weeks</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                {rows.length === 0 ? "No centers yet — click Sync from FC28" : "No results"}
              </td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={`transition-colors ${isEditing(r.id) ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2.5 text-gray-900 font-medium">{r.centerName}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.centerShort ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {isEditing(r.id) ? (
                    <input
                      type="number" step="0.01" min="0"
                      value={drafts[r.id] ?? ""}
                      onChange={e => setDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") save(r.id); if (e.key === "Escape") cancelEdit(r.id, r); }}
                      placeholder="e.g. 4.33"
                      autoFocus={editing.has(r.id) && !editAll}
                      className="w-28 px-2 py-1 border border-amber-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  ) : (
                    <span className={r.coreWeeks != null ? "text-gray-900 font-medium" : "text-gray-400 italic"}>
                      {r.coreWeeks != null ? r.coreWeeks : "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {isEditing(r.id) ? (
                    <div className="flex items-center justify-end gap-1.5">
                      {!editAll && (
                        <>
                          <button onClick={() => save(r.id)} disabled={saving === r.id}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-white disabled:opacity-40 transition-colors ${
                              saved[r.id] ? "bg-blue-600" : "bg-green-600 hover:bg-green-700"
                            }`}>
                            <Check className="w-3 h-3" />
                            {saving === r.id ? "Saving…" : saved[r.id] ? "Saved" : "Save"}
                          </button>
                          <button onClick={() => cancelEdit(r.id, r)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100">
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => startEdit(r.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 ml-auto">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
