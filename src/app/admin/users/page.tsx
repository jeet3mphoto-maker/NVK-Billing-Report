"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { Users, Plus, Edit2, Shield, Search } from "lucide-react";

const ROLES = ["SUPER_ADMIN","ADMINISTRATOR","FINANCE_MANAGER","BILLING_MANAGER","CENTER_DIRECTOR","CENTER_MANAGER","BILLING_ANALYST","READ_ONLY"];

const USERS = [
  { id:"1", name:"Admin User",          email:"admin@asaind.co.in",      role:"SUPER_ADMIN",      center:"All",            active:true,  lastLogin:"Today 08:30" },
  { id:"2", name:"Shiva Kumar",         email:"shivakumar.aitharaju@asaind.co.in", role:"ADMINISTRATOR", center:"All", active:true,  lastLogin:"Today 09:15" },
  { id:"3", name:"Finance Director",    email:"finance@asaind.co.in",    role:"FINANCE_MANAGER",  center:"All",            active:true,  lastLogin:"Yesterday"   },
  { id:"4", name:"Billing Team Lead",   email:"billing@asaind.co.in",    role:"BILLING_MANAGER",  center:"All",            active:true,  lastLogin:"Today 07:45" },
  { id:"5", name:"Andover Director",    email:"andover@asaind.co.in",    role:"CENTER_DIRECTOR",  center:"Andover MA",     active:true,  lastLogin:"2 days ago"  },
  { id:"6", name:"Ashburn Manager",     email:"ashburn@asaind.co.in",    role:"CENTER_MANAGER",   center:"Ashburn VA",     active:true,  lastLogin:"3 days ago"  },
  { id:"7", name:"Billing Analyst 1",   email:"analyst1@asaind.co.in",   role:"BILLING_ANALYST",  center:"All",            active:true,  lastLogin:"Today 10:00" },
  { id:"8", name:"Read Only User",      email:"readonly@asaind.co.in",   role:"READ_ONLY",        center:"All",            active:false, lastLogin:"1 week ago"  },
];

const roleVariant: Record<string, "danger"|"warning"|"info"|"success"|"gray"|"default"> = {
  SUPER_ADMIN:"danger", ADMINISTRATOR:"warning", FINANCE_MANAGER:"info",
  BILLING_MANAGER:"success", CENTER_DIRECTOR:"default", CENTER_MANAGER:"gray",
  BILLING_ANALYST:"info", READ_ONLY:"gray",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const filtered = USERS.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Manage Users" user={{ name:"Admin", email:"admin@asaind.co.in", role:"SUPER_ADMIN" }} />
      <div className="p-6 space-y-4">

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003887]" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003887]">
            <option value="ALL">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
          </select>
          <button className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background:"#003887" }}>
            <Plus className="w-3.5 h-3.5" /> Invite User
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["User","Email","Role","Center Access","Status","Last Login","Actions"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background:"#003887" }}>
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{u.email}</td>
                  <td className="px-4 py-2.5"><Badge variant={roleVariant[u.role]}>{u.role.replace(/_/g," ")}</Badge></td>
                  <td className="px-4 py-2.5 text-gray-600">{u.center}</td>
                  <td className="px-4 py-2.5"><Badge variant={u.active?"success":"gray"}>{u.active?"Active":"Inactive"}</Badge></td>
                  <td className="px-4 py-2.5 text-gray-400">{u.lastLogin}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button className="text-[#003887] hover:text-[#002a6b]"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="text-gray-400 hover:text-gray-600"><Shield className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
