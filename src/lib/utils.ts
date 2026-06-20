import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "0.0%";
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  return new Intl.NumberFormat("en-US").format(n);
}

export function billingPeriodLabel(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function getVarianceColor(variance: number): string {
  if (variance === 0) return "text-green-600";
  if (variance > 0) return "text-blue-600";
  return "text-red-600";
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "bg-red-100 text-red-800";
    case "HIGH":     return "bg-orange-100 text-orange-800";
    case "MEDIUM":   return "bg-yellow-100 text-yellow-800";
    case "LOW":      return "bg-green-100 text-green-800";
    default:         return "bg-gray-100 text-gray-800";
  }
}

export function getBillingStatusColor(status: string): string {
  switch (status) {
    case "MATCHED":             return "bg-green-100 text-green-800";
    case "UNDERBILLED":         return "bg-blue-100 text-blue-800";
    case "OVERBILLED":          return "bg-purple-100 text-purple-800";
    case "NOT_BILLED":          return "bg-red-100 text-red-800";
    case "PARTIALLY_BILLED":    return "bg-yellow-100 text-yellow-800";
    case "ADJUSTMENT_REQUIRED": return "bg-orange-100 text-orange-800";
    default:                    return "bg-gray-100 text-gray-800";
  }
}
