"use client";

import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { FileText, User, Upload, Edit2, Lock, Download } from "lucide-react";

const LOG = [
  { id:1,  user:"admin@asaind.co.in",     action:"FILE_UPLOAD",     entity:"FileUpload",   detail:"Uploaded FC28 — 1284 records processed",        ip:"172.16.16.1", time:"08:32 AM" },
  { id:2,  user:"admin@asaind.co.in",     action:"FILE_UPLOAD",     entity:"FileUpload",   detail:"Uploaded FIN14-AR Andover MA — 342 records",     ip:"172.16.16.1", time:"08:33 AM" },
  { id:3,  user:"billing@asaind.co.in",   action:"RECORD_CHANGE",   entity:"Enrollment",   detail:"Changed rate for C007 from $400 to $450",        ip:"172.16.16.5", time:"09:15 AM" },
  { id:4,  user:"finance@asaind.co.in",   action:"EXPORT",          entity:"Report",       detail:"Exported Billing Reconciliation Report (Excel)",  ip:"172.16.16.8", time:"10:01 AM" },
  { id:5,  user:"admin@asaind.co.in",     action:"USER_LOGIN",      entity:"User",         detail:"Successful login from 172.16.16.1",              ip:"172.16.16.1", time:"08:30 AM" },
  { id:6,  user:"analyst1@asaind.co.in",  action:"ISSUE_RESOLVED",  entity:"BillingIssue", detail:"Resolved issue #3 — Revenue Leakage at Ashburn",  ip:"172.16.16.9", time:"11:22 AM" },
  { id:7,  user:"admin@asaind.co.in",     action:"BILLING_ADJUST",  entity:"Transaction",  detail:"Adjustment applied to Family F003 — $(200.00)",  ip:"172.16.16.1", time:"11:45 AM" },
  { id:8,  user:"finance@asaind.co.in",   action:"PERMISSION_CHANGE",entity:"User",        detail:"Role changed for readonly@asaind.co.in to BILLING_ANALYST", ip:"172.16.16.8", time:"12:03 PM" },
];

const actionIcon: Record<string, any> = {
  FILE_UPLOAD:"📁", RECORD_CHANGE:"✏️", EXPORT:"📤", USER_LOGIN:"🔐",
  ISSUE_RESOLVED:"✅", BILLING_ADJUST:"💰", PERMISSION_CHANGE:"🔑",
};

const actionVariant: Record<string, "default"|"success"|"warning"|"info"|"danger"|"gray"> = {
  FILE_UPLOAD:"default", RECORD_CHANGE:"warning", EXPORT:"info", USER_LOGIN:"success",
  ISSUE_RESOLVED:"success", BILLING_ADJUST:"warning", PERMISSION_CHANGE:"danger",
};

export default function AuditLogPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Audit Log" user={{ name:"Admin", email:"admin@asaind.co.in", role:"SUPER_ADMIN" }} />
      <div className="p-6 space-y-4">

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4 text-[#003887]" />
            <span>Showing today's activity — {LOG.length} events</span>
          </div>
          <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["#","Time","User","Action","Entity","Detail","IP Address"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {LOG.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400">{entry.id}</td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono">{entry.time}</td>
                  <td className="px-4 py-2.5 text-[#003887] font-medium truncate max-w-[160px]">{entry.user}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span>{actionIcon[entry.action]}</span>
                      <Badge variant={actionVariant[entry.action]}>{entry.action.replace(/_/g," ")}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{entry.entity}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{entry.detail}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-400">{entry.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 text-center">All user actions are permanently logged and cannot be deleted. Retained for 7 years per compliance requirements.</p>
      </div>
    </div>
  );
}
