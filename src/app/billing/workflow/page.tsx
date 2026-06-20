"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import { Workflow, CheckCircle2, Clock, AlertTriangle, User2, MessageSquare } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const ISSUES = [
  { id:1,  type:"Missing Invoice",    center:"Franklin MA",  child:"Noah Wilson",   severity:"CRITICAL", status:"OPEN",          assignee:"billing@asaind.co.in",  amount:1650, created:"Jun 1", updated:"Jun 8", comments:2 },
  { id:2,  type:"Rate Mismatch",      center:"Ashburn VA",   child:"Sophia Taylor", severity:"HIGH",     status:"INVESTIGATING",  assignee:"analyst1@asaind.co.in", amount:225,  created:"Jun 2", updated:"Jun 7", comments:4 },
  { id:3,  type:"Revenue Leakage",    center:"Gaithersburg", child:"Mia Thompson",  severity:"HIGH",     status:"PENDING_REVIEW", assignee:"finance@asaind.co.in",  amount:450,  created:"Jun 3", updated:"Jun 6", comments:1 },
  { id:4,  type:"Duplicate Billing",  center:"Franklin MA",  child:"James Brown",   severity:"MEDIUM",   status:"OPEN",          assignee:"analyst1@asaind.co.in", amount:450,  created:"Jun 4", updated:"Jun 8", comments:0 },
  { id:5,  type:"Revenue Leakage",    center:"Andover MA",   child:"Emma Wilson",   severity:"LOW",      status:"RESOLVED",       assignee:"billing@asaind.co.in",  amount:360,  created:"May 28",updated:"Jun 5", comments:3 },
  { id:6,  type:"Missing Invoice",    center:"Ashburn VA",   child:"Ava Garcia",    severity:"CRITICAL", status:"OPEN",          assignee:"",                      amount:1800, created:"Jun 5", updated:"Jun 8", comments:0 },
];

const STATUSES = ["OPEN","INVESTIGATING","PENDING_REVIEW","RESOLVED","CLOSED"];
const statusVariant: Record<string, "danger"|"warning"|"info"|"success"|"gray"> = {
  OPEN:"danger", INVESTIGATING:"warning", PENDING_REVIEW:"info", RESOLVED:"success", CLOSED:"gray",
};
const severityVariant: Record<string, "danger"|"warning"|"info"|"gray"> = {
  CRITICAL:"danger", HIGH:"warning", MEDIUM:"info", LOW:"gray",
};

export default function WorkflowPage() {
  const [issues, setIssues] = useState(ISSUES);
  const [selected, setSelected] = useState<typeof ISSUES[0] | null>(null);

  function updateStatus(id: number, status: string) {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Billing Workflow Management" user={{ name:"Admin", email:"admin@asaind.co.in", role:"SUPER_ADMIN" }} />
      <div className="p-6 space-y-5">

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {STATUSES.map(s => (
            <div key={s} className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
              <div className="text-xl font-bold" style={{ color: s==="OPEN"?"#ef4444":s==="INVESTIGATING"?"#f97316":s==="PENDING_REVIEW"?"#003887":s==="RESOLVED"?"#22c55e":"#A6A6A6" }}>
                {issues.filter(i => i.status === s).length}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{s.replace(/_/g," ")}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          {/* Issue list */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">All Issues</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {issues.map(issue => (
                <div
                  key={issue.id}
                  onClick={() => setSelected(issue)}
                  className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === issue.id ? "bg-blue-50 border-l-2 border-l-[#003887]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-800">#{issue.id} — {issue.type}</span>
                        <Badge variant={severityVariant[issue.severity]}>{issue.severity}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{issue.child} · {issue.center}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {issue.assignee ? `Assigned: ${issue.assignee.split("@")[0]}` : "Unassigned"} · {issue.updated}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant={statusVariant[issue.status]}>{issue.status.replace(/_/g," ")}</Badge>
                      <span className="text-xs font-bold text-red-600">{formatCurrency(issue.amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100" style={{ background:"#003887" }}>
                <h3 className="text-sm font-bold text-white">Issue #{selected.id}</h3>
                <p className="text-xs text-blue-200">{selected.type}</p>
              </div>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {[
                  { label:"Child",    value:selected.child },
                  { label:"Center",   value:selected.center },
                  { label:"Impact",   value:formatCurrency(selected.amount) },
                  { label:"Created",  value:selected.created },
                  { label:"Updated",  value:selected.updated },
                ].map(f => (
                  <div key={f.label} className="flex justify-between text-xs">
                    <span className="text-gray-500">{f.label}</span>
                    <span className="font-medium text-gray-800">{f.value}</span>
                  </div>
                ))}

                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Update Status</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STATUSES.filter(s => s !== selected.status).map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selected.id, s)}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:border-[#003887] hover:text-[#003887] transition-colors"
                      >
                        {s.replace(/_/g," ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Add Comment</p>
                  <textarea
                    rows={3}
                    placeholder="Add resolution note…"
                    className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#003887]"
                  />
                  <button className="mt-1.5 w-full py-1.5 rounded-lg text-xs font-medium text-white" style={{ background:"#003887" }}>
                    Save Comment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
