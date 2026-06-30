"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Users, Plus, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";

interface Employee { id: number; name: string; isActive: boolean; createdAt: string }

export default function AsaEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [newName,   setNewName]   = useState("");
  const [adding,    setAdding]    = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [reapplyResult, setReapplyResult] = useState<{ reapplied: number; asaCount: number; centerCount: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/asa-employees");
      const json = await res.json();
      setEmployees(json.employees ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addEmployee = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/admin/asa-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await load();
    } finally { setAdding(false); }
  };

  const removeEmployee = async (id: number) => {
    if (!confirm("Remove this employee?")) return;
    await fetch(`/api/admin/asa-employees?id=${id}`, { method: "DELETE" });
    await load();
  };

  const reapply = async () => {
    if (!confirm("Re-evaluate Entry By for ALL existing unmatched FIN14 rows? This may take a moment.")) return;
    setReapplying(true);
    setReapplyResult(null);
    try {
      const res  = await fetch("/api/admin/asa-employees?reapply=1", { method: "POST" });
      const json = await res.json();
      setReapplyResult(json);
    } finally { setReapplying(false); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">ASA Employee Master</h1>
            <p className="text-sm text-slate-500">
              Names here are matched against the <span className="font-medium text-slate-700">"Created By"</span> column in FIN14.
              Matched rows get <span className="font-semibold text-blue-700">Entry By = ASA</span>; unmatched get <span className="font-semibold text-orange-600">Center</span>.
            </p>
          </div>
        </div>

        {/* Add employee */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Add Employee</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmployee()}
              placeholder="Enter full name exactly as it appears in FIN14 Created By column"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addEmployee}
              disabled={adding || !newName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </div>

        {/* Employee list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {employees.length} employee{employees.length !== 1 ? "s" : ""} on record
            </span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No employees added yet. Add a name above to get started.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                      {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-800">{emp.name}</span>
                  </div>
                  <button
                    onClick={() => removeEmployee(emp.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Re-apply to existing rows */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-amber-900 mb-1">Re-apply to Existing FIN14 Rows</p>
          <p className="text-xs text-amber-700 mb-4">
            FIN14 rows already in the database won't be updated automatically when you add employees.
            Use this to re-evaluate <em>all unmatched rows</em> against the current employee list.
          </p>
          {reapplyResult && (
            <div className="flex items-center gap-2 mb-3 text-sm text-green-700 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {reapplyResult.reapplied.toLocaleString()} rows re-evaluated —{" "}
              {reapplyResult.asaCount.toLocaleString()} marked ASA, {reapplyResult.centerCount.toLocaleString()} marked Center
            </div>
          )}
          <button
            onClick={reapply}
            disabled={reapplying}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-700 text-white text-sm font-semibold disabled:opacity-50 hover:bg-amber-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${reapplying ? "animate-spin" : ""}`} />
            {reapplying ? "Re-applying…" : "Re-apply Entry By to All Rows"}
          </button>
        </div>
      </main>
    </div>
  );
}
