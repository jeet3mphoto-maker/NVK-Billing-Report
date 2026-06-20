"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Download, FolderOpen, RefreshCw, FileSpreadsheet, Info } from "lucide-react";

export default function FC28HistoryPage() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [stats,   setStats]   = useState<{ rows: number; file: string } | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    setStats(null);
    try {
      const res = await fetch("/api/fc28/history");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const rows   = res.headers.get("X-Row-Count") ?? "?";
      const blob   = await res.blob();
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = url;
      a.download   = `FC28_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setStats({ rows: Number(rows), file: a.download });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="FC28 History" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />

      <div className="p-8 max-w-3xl mx-auto w-full space-y-6">

        {/* Title */}
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">FC28 Consolidated History</h1>
            <p className="text-sm text-gray-500 mt-0.5">Merge all weekly FC28 files into one sorted, deduplicated Excel report</p>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
            <Info className="w-4 h-4" /> What this does
          </div>
          <ul className="text-sm text-blue-700 space-y-1.5 list-disc list-inside">
            <li>Reads all Excel files from the <span className="font-mono font-semibold">FC 28 History</span> folder</li>
            <li>Adds <span className="font-semibold">FC28 Report Date</span> column from each filename</li>
            <li>Removes exact duplicate rows (same child, same data across multiple weekly files)</li>
            <li>Sorts by <span className="font-semibold">Child ID</span> → <span className="font-semibold">Report Date</span></li>
            <li>Downloads as a single Excel file</li>
          </ul>
        </div>

        {/* FC28 → FIN14 enrichment note */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
            <FileSpreadsheet className="w-4 h-4" /> FIN14 Export Enrichment
          </div>
          <p className="text-sm text-green-700">
            When you export FIN14 transactions from the <a href="/upload/review" className="underline font-semibold">Review &amp; Flag</a> page,
            the latest FC28 values are automatically added as the <span className="font-semibold">first 4 columns</span>:
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {["Start Date (FC28)", "Date of Birth (FC28)", "Withdrawal Date (FC28)", "Billing Cycle (FC28)"].map((col) => (
              <span key={col} className="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-semibold">{col}</span>
            ))}
          </div>
          <p className="text-xs text-green-600 mt-1">
            Join key: <span className="font-mono font-semibold">Child ID</span> — matched from FIN14 transactions to the latest FC28 weekly report.
          </p>
        </div>

        {/* Download button */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <p className="text-sm text-gray-500">Click to generate and download the consolidated FC28 history file</p>
          <button
            onClick={download}
            disabled={loading}
            className="inline-flex items-center gap-2.5 px-8 py-3 text-sm font-bold text-white rounded-xl shadow disabled:opacity-50 transition-all hover:brightness-110"
            style={{ background: "#003887" }}
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Download className="w-4 h-4" /> Download FC28 Consolidated History</>}
          </button>

          {stats && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Downloaded {stats.rows.toLocaleString()} rows → {stats.file}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-500 font-medium">{error}</div>
          )}
        </div>

      </div>
    </div>
  );
}
