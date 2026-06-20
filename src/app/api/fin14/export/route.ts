import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const db = prisma as any;

function computeEntryBy(itemText: string | null, subHead: string | null): string {
  if (subHead === "Adjustments" && itemText) {
    const t = itemText.toUpperCase();
    if (t.includes("ASA ") || t.includes("ASA_") || t.includes("ASA-")) return "ASA";
  }
  return "CENTER";
}

// GET /api/fin14/export — same filters as /api/fin14 but returns full Excel
// Adds FC28 columns (Start Date, DOB, Withdrawal Date, Billing Cycle) at the front
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;

  const where: any = {};
  const batchId    = sp.get("batchId");
  const isMatched  = sp.get("isMatched");
  const majorHead  = sp.get("majorHead");
  const subHead    = sp.get("subHead");
  const itemSearch = sp.get("itemSearch");
  if (batchId)               where.batchId   = batchId;
  if (isMatched === "true")  where.isMatched = true;
  if (isMatched === "false") where.isMatched = false;
  if (majorHead)             where.majorHead = majorHead;
  if (subHead)               where.subHead   = subHead;
  if (itemSearch)            where.itemText  = { contains: itemSearch, mode: "insensitive" };

  const rows = await db.fin14Row.findMany({ where, orderBy: { id: "asc" } });

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to export" }, { status: 404 });
  }

  // Build Excel rows: FC28 columns first, then all rawData columns, then our added columns
  const rawKeys: string[] = rows[0]?.rawData ? Object.keys(rows[0].rawData) : [];

  const outputRows = rows.map((row: any) => {
    const out: Record<string, any> = {};

    // ── FC28 enrichment columns at the FRONT (populated by Map FC28 step) ──
    out["Start Date (FC28)"]      = row.rawData?.["Start Date (FC28)"]      ?? "";
    out["Date of Birth (FC28)"]   = row.rawData?.["Date of Birth (FC28)"]   ?? "";
    out["Withdrawal Date (FC28)"] = row.rawData?.["Withdrawal Date (FC28)"] ?? "";
    out["Billing Cycle (FC28)"]   = row.rawData?.["Billing Cycle (FC28)"]   ?? "";

    // ── Original FIN14 columns ──
    for (const k of rawKeys) out[k] = row.rawData[k] ?? "";

    // ── Our flagging columns ──
    out["Major Head"] = row.majorHead ?? "";
    out["Sub Head"]   = row.subHead   ?? "";
    out["Entry By"]   = computeEntryBy(row.itemText, row.subHead);
    out["Matched By"] = row.entryBy   ?? "";
    out["Status"]     = row.isMatched ? "Matched" : "Unmatched";

    return out;
  });

  const ws = XLSX.utils.json_to_sheet(outputRows);

  // Auto column widths
  const colWidths = Object.keys(outputRows[0] ?? {}).map((k) => ({
    wch: Math.max(k.length, ...outputRows.slice(0, 50).map((r: any) => String(r[k] ?? "").length), 10),
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FIN14 Review");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `FIN14_Review_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Row-Count": String(rows.length),
    },
  });
}
