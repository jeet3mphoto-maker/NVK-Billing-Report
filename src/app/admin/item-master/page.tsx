"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { Plus, Pencil, Trash2, Save, X, RefreshCw, Search, BookOpen, CheckCircle2 } from "lucide-react";

const MAJOR_HEADS = ["Adjustments", "Billing", "Payment"];
const SUB_HEADS: Record<string, string[]> = {
  Adjustments: ["Adjustments", "Discount"],
  Billing:     ["Regular", "Agency", "Early/Late", "One Time", "Other"],
  Payment:     ["Agency"],
};

interface ItemMaster {
  id: number;
  item: string;
  majorHead: string;
  subHead: string;
  entryBy: string;
  isActive: boolean;
  createdAt: string;
}

const MH_COLORS: Record<string, string> = {
  Billing:     "bg-blue-100 text-blue-700",
  Adjustments: "bg-purple-100 text-purple-700",
  Payment:     "bg-green-100 text-green-700",
};
const SH_COLORS: Record<string, string> = {
  Regular:      "bg-sky-50 text-sky-700",
  Agency:       "bg-teal-50 text-teal-700",
  "Early/Late": "bg-orange-50 text-orange-700",
  "One Time":   "bg-pink-50 text-pink-700",
  Other:        "bg-gray-100 text-gray-600",
  Discount:     "bg-yellow-50 text-yellow-700",
  Adjustments:  "bg-purple-50 text-purple-700",
};

// ── Inline row editor ─────────────────────────────────────────────────────────

function EditRow({
  item,
  onSave,
  onCancel,
}: { item: ItemMaster; onSave: (id: number, data: Partial<ItemMaster>) => Promise<void>; onCancel: () => void }) {
  const [itemText,  setItemText]  = useState(item.item);
  const [majorHead, setMajorHead] = useState(item.majorHead);
  const [subHead,   setSubHead]   = useState(item.subHead);
  const [saving,    setSaving]    = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(item.id, { item: itemText.trim(), majorHead, subHead });
    setSaving(false);
  };

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2" colSpan={2}>
        <input
          value={itemText}
          onChange={(e) => setItemText(e.target.value)}
          className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <select value={majorHead} onChange={(e) => { setMajorHead(e.target.value); setSubHead(SUB_HEADS[e.target.value][0]); }}
          className="border border-blue-200 rounded-lg px-2 py-1.5 text-sm w-full">
          {MAJOR_HEADS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </td>
      <td className="px-4 py-2">
        <select value={subHead} onChange={(e) => setSubHead(e.target.value)}
          className="border border-blue-200 rounded-lg px-2 py-1.5 text-sm w-full">
          {(SUB_HEADS[majorHead] ?? []).map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-4 py-2 text-xs text-gray-400">{item.entryBy}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving || !itemText.trim()}
            className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white rounded-lg disabled:opacity-40"
            style={{ background: "#003887" }}>
            <Save className="w-3 h-3" />{saving ? "…" : "Save"}
          </button>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Add new row form ──────────────────────────────────────────────────────────

function AddRow({ onAdded }: { onAdded: () => void }) {
  const [open,      setOpen]      = useState(false);
  const [itemText,  setItemText]  = useState("");
  const [majorHead, setMajorHead] = useState("Billing");
  const [subHead,   setSubHead]   = useState("Regular");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  const save = async () => {
    if (!itemText.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/item-master", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemText.trim(), majorHead, subHead, entryBy: "Manual" }),
      });
      if (!res.ok) throw new Error("Save failed");
      setItemText(""); setMajorHead("Billing"); setSubHead("Regular");
      setOpen(false);
      onAdded();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm"
      style={{ background: "#003887" }}>
      <Plus className="w-4 h-4" /> Add Item
    </button>
  );

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">New Item</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[280px]">
          <label className="text-xs font-semibold text-gray-500 block mb-1">Item Text (search keyword)</label>
          <input value={itemText} onChange={(e) => setItemText(e.target.value)}
            placeholder="e.g. CORE Payments"
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Major Head</label>
          <select value={majorHead} onChange={(e) => { setMajorHead(e.target.value); setSubHead(SUB_HEADS[e.target.value][0]); }}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm">
            {MAJOR_HEADS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Sub Head</label>
          <select value={subHead} onChange={(e) => setSubHead(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm">
            {(SUB_HEADS[majorHead] ?? []).map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !itemText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40"
            style={{ background: "#003887" }}>
            <Save className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm border rounded-lg text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ItemMasterPage() {
  const [items,    setItems]    = useState<ItemMaster[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [editId,   setEditId]   = useState<number | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/item-master");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const saveEdit = async (id: number, data: Partial<ItemMaster>) => {
    await fetch("/api/item-master", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    setEditId(null);
    await load();
    showToast("Item updated");
  };

  const deleteItem = async (id: number) => {
    await fetch(`/api/item-master?id=${id}`, { method: "DELETE" });
    await load();
    showToast("Item removed");
  };

  const filtered = items.filter((i) =>
    !search || i.item.toLowerCase().includes(search.toLowerCase()) ||
    i.majorHead.toLowerCase().includes(search.toLowerCase()) ||
    i.subHead.toLowerCase().includes(search.toLowerCase())
  );

  // Group by Major Head
  const grouped = MAJOR_HEADS.reduce<Record<string, ItemMaster[]>>((acc, mh) => {
    acc[mh] = filtered.filter((i) => i.majorHead === mh);
    return acc;
  }, {});

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Item Master" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />

      <div className="p-6 max-w-5xl mx-auto w-full space-y-5">

        {/* Header actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-800">Item Flagging Master</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length} items</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-52" />
          </div>
          <AddRow onAdded={() => { load(); showToast("Item added to master"); }} />
        </div>

        {/* Table grouped by Major Head */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          MAJOR_HEADS.map((mh) => {
            const rows = grouped[mh] ?? [];
            if (rows.length === 0 && search) return null;
            return (
              <div key={mh} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Group header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3" style={{ background: mh === "Billing" ? "#eff6ff" : mh === "Adjustments" ? "#faf5ff" : "#f0fdf4" }}>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${MH_COLORS[mh] ?? "bg-gray-100 text-gray-600"}`}>{mh}</span>
                  <span className="text-xs text-gray-400">{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
                </div>

                {rows.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-gray-400 italic">No items</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-2 text-left w-8">#</th>
                        <th className="px-5 py-2 text-left">Item Search Pattern</th>
                        <th className="px-4 py-2 text-left">Major Head</th>
                        <th className="px-4 py-2 text-left">Sub Head</th>
                        <th className="px-4 py-2 text-left">Added By</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((item) =>
                        editId === item.id ? (
                          <EditRow key={item.id} item={item} onSave={saveEdit} onCancel={() => setEditId(null)} />
                        ) : (
                          <tr key={item.id} className="hover:bg-gray-50/60 group">
                            <td className="px-5 py-2.5 text-xs text-gray-300">{item.id}</td>
                            <td className="px-5 py-2.5 text-gray-800 font-medium max-w-sm">
                              <span className="font-mono text-xs bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{item.item}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${MH_COLORS[item.majorHead] ?? "bg-gray-100 text-gray-600"}`}>
                                {item.majorHead}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SH_COLORS[item.subHead] ?? "bg-gray-100 text-gray-600"}`}>
                                {item.subHead}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400">{item.entryBy}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditId(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500" title="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteItem(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Remove">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}
    </div>
  );
}
