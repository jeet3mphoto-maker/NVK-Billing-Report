import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  format?: "currency" | "number" | "percent" | "raw";
  icon?: LucideIcon;
  color?: string;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  className?: string;
}

export default function StatCard({
  title, value, format = "raw", icon: Icon, color = "#003887",
  trend, trendLabel, subtitle, className,
}: StatCardProps) {
  const formatted =
    format === "currency" ? formatCurrency(Number(value)) :
    format === "number"   ? formatNumber(Number(value)) :
    format === "percent"  ? formatPercent(Number(value)) :
    String(value);

  const TrendIcon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null ? "text-slate-400" : trend > 0 ? "text-emerald-500" : "text-rose-500";

  return (
    <div className={cn(
      "relative overflow-hidden bg-white rounded-xl border border-slate-200 p-4 shadow-sm",
      "transition-all duration-300 ease-out hover:border-blue-300 hover:shadow-md",
      className
    )}>
      {/* Decorative accent line at top */}
      <div className="absolute top-0 left-0 w-full h-1" style={{ background: color }} />
      
      <div className="flex items-center justify-between relative z-10 mb-2">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        {Icon && (
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-100" 
            style={{ color: color }}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      
      <div className="relative z-10">
        <p className="text-[22px] font-black tracking-tight text-slate-800">{formatted}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{subtitle}</p>}
      </div>

      {trend != null && (
        <div className={cn("flex items-center gap-1.5 mt-3 text-xs font-semibold", trendColor)}>
          <div className={cn("flex items-center justify-center w-4 h-4 rounded-full", trend > 0 ? "bg-emerald-500/10" : "bg-rose-500/10")}>
            <TrendIcon className="w-3 h-3" />
          </div>
          <span>{Math.abs(trend).toFixed(1)}% {trendLabel ?? "vs last month"}</span>
        </div>
      )}
    </div>
  );
}
