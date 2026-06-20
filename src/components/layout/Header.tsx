"use client";

import { signOut } from "next-auth/react";
import { Bell, LogOut, User, ChevronDown } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  title: string;
  user?: { name?: string | null; email?: string | null; role?: string };
}

export default function Header({ title, user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-white/70 backdrop-blur-xl border-b border-white/60 flex items-center justify-between px-6 sticky top-0 z-30 shadow-[0_1px_12px_rgba(15,23,42,0.04)]">
      <h1 className="text-base font-bold tracking-tight text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-[#003887] transition-colors rounded-lg hover:bg-slate-100/60">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100/70 transition-colors"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "#003887" }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-gray-800">{user?.name ?? "User"}</div>
              <div className="text-xs text-gray-500">{user?.role?.replace("_", " ") ?? ""}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-xs text-gray-500 truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
