"use client";

import Header from "@/components/layout/Header";
import { FileText, Download, BarChart3, Users, Building2, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";

const REPORTS = [
  { id: "billed-vs-expected", title: "Billed vs Expected Report", desc: "Child, family, center, and program level billing comparison", icon: BarChart3, color: "#003887" },
  { id: "revenue-leakage", title: "Revenue Leakage Report", desc: "Lost revenue, leakage reasons, and recovery opportunities", icon: TrendingUp, color: "#ef4444" },
{ id: "billing-exceptions", title: "Billing Exception Report", desc: "Critical and high priority billing issues", icon: AlertTriangle, color: "#f59e0b" },
  { id: "child-billing-history", title: "Child Billing History", desc: "Complete historical audit per child", icon: FileText, color: "#8b5cf6" },
  { id: "monthly-reconciliation", title: "Monthly Revenue Reconciliation", desc: "Month-by-month revenue analysis", icon: DollarSign, color: "#06b6d4" },
  { id: "center-performance", title: "Center Performance Report", desc: "Revenue, attendance, and billing accuracy per center", icon: Building2, color: "#f97316" },
  { id: "fc28-change-log", title: "FC28 Change Log Report", desc: "All enrollment changes with before/after values", icon: FileText, color: "#003887" },
];

const FORMATS = ["Excel", "CSV", "PDF"];

export default function ReportsPage() {
  function download(reportId: string, format: string) {
    fetch(`/api/reports/${reportId}?format=${format.toLowerCase()}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not available");
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportId}.${format.toLowerCase()}`;
        a.click();
      })
      .catch(() => alert(`${format} export coming soon!`));
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Report Center" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${r.color}15` }}>
                    <Icon className="w-5 h-5" style={{ color: r.color }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500 mr-1">Export:</span>
                  {FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => download(r.id, fmt)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200 text-gray-700 hover:border-[#003887] hover:text-[#003887] transition-colors"
                    >
                      <Download className="w-3 h-3" /> {fmt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
