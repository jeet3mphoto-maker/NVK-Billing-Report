"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import Header from "@/components/layout/Header";

const ADMIN = { name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" };

/** Full-page premium shell: slate canvas, ambient glows, sticky header, centered container. */
export function PageShell({ title, subtitle, actions, children }: {
  title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50/70 relative">
      {/* ambient glows */}
      <div className="pointer-events-none absolute top-[-120px] right-1/4 w-[560px] h-[560px] bg-blue-500/10 rounded-full blur-[130px]" />
      <div className="pointer-events-none absolute top-1/3 left-[-80px] w-[420px] h-[420px] bg-indigo-400/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[420px] h-[420px] bg-emerald-300/10 rounded-full blur-[120px]" />

      <Header title={title} user={ADMIN} />
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 py-6">
        {(subtitle || actions) && (
          <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-800">{title}</h2>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}

/** Premium KPI tile with colored accent bar + icon chip. */
export function KpiCard({ label, value, icon: Icon, color = "#003887", sub, tone }: {
  label: string; value: string | number; icon?: LucideIcon; color?: string; sub?: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/70 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
      <div className="absolute top-0 left-0 h-full w-1 rounded-r" style={{ background: color }} />
      <div className="flex items-start justify-between pl-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
          <p className={cn("text-[22px] font-black tracking-tight leading-none",
            tone === "up" ? "text-blue-600" : tone === "down" ? "text-rose-600" : "text-slate-800")}>{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1.5 truncate">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: `${color}14` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Glass section container. */
export function GlassCard({ title, icon: Icon, actions, className, bodyClassName, children }: {
  title?: string; icon?: LucideIcon; actions?: React.ReactNode; className?: string; bodyClassName?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(15,23,42,0.05)] overflow-hidden", className)}>
      {(title || actions) && (
        <div className="px-5 py-4 border-b border-slate-100/70 flex items-center justify-between gap-3 bg-white/40">
          <div className="flex items-center gap-2.5">
            {Icon && <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100"><Icon className="w-4 h-4 text-[#003887]" /></div>}
            {title && <h3 className="text-sm font-bold text-slate-800">{title}</h3>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/** Pill toggle button. */
export function Pill({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm",
        active ? "text-white border-transparent shadow-md" : "bg-white/70 backdrop-blur border-slate-200/70 text-slate-600 hover:bg-white hover:border-slate-300")}
      style={active ? { background: "#003887" } : {}}>
      {children}
    </button>
  );
}

/** Secondary action button (premium outline). */
export function GhostButton({ href, onClick, icon: Icon, children }: { href?: string; onClick?: () => void; icon?: LucideIcon; children: React.ReactNode }) {
  const cls = "inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200/70 bg-white/70 backdrop-blur text-slate-600 hover:text-[#003887] hover:border-[#003887]/40 shadow-sm transition-all";
  if (href) return <a href={href} className={cls}>{Icon && <Icon className="w-3.5 h-3.5" />}{children}</a>;
  return <button onClick={onClick} className={cls}>{Icon && <Icon className="w-3.5 h-3.5" />}{children}</button>;
}
