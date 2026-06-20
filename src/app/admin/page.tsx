"use client";

import Header from "@/components/layout/Header";
import { Settings, Users, Building2, DollarSign, Shield, FileText, BarChart3 } from "lucide-react";
import Link from "next/link";

const SECTIONS = [
  { title: "Centers", desc: "Manage all 49 childcare centers", icon: Building2, href: "/admin/centers",   color: "#003887" },
  { title: "Users",   desc: "Manage users and permissions",    icon: Users,     href: "/admin/users",     color: "#8b5cf6" },
  { title: "Rate Types", desc: "Configure billing rate types", icon: DollarSign,href: "/admin/rates",     color: "#22c55e" },
  { title: "Roles",   desc: "Configure role-based access",     icon: Shield,    href: "/admin/roles",     color: "#f59e0b" },
  { title: "Audit Log",  desc: "View all system activity",     icon: FileText,  href: "/admin/audit",     color: "#ef4444" },
  { title: "Processing Logs", desc: "ETL and file processing logs", icon: BarChart3, href: "/admin/logs", color: "#06b6d4" },
];

export default function AdminPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Administration" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{s.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
