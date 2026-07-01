import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const db = prisma as any;

function computeEntryBy(itemText: string | null, subHead: string | null): string {
  if (subHead === "Adjustments" && itemText) {
    const t = itemText.toUpperCase();
    if (t.includes("ASA ") || t.includes("ASA_") || t.includes("ASA-")) return "ASA";
  }
  return "CENTER";
}

// GET /api/fin14/export — downloads all visible FIN14 rows as Excel
// Columns match exactly what is shown on screen (union of all rawData keys + system cols)
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const where: any = {};
    const isMatched  = sp.get("isMatched");
    const majorHead  = sp.get("majorHead");
    const subHead    = sp.get("subHead");
    const itemSearch = sp.get("itemSearch");
    if (isMatched === "true")  where.isMatched = true;
    if (isMatched === "false") where.isMatched = false;
    if (majorHead)             where.majorHead = majorHead;
    if (subHead)               where.subHead   = subHead;
    if (itemSearch)            where.itemText  = { contains: itemSearch, mode: "insensitive" };

    const rows = await db.fin14Row.findMany({ where, orderBy: { id: "asc" } });
    if (!rows.length) return NextResponse.json({ error: "No rows to export" }, { status: 404 });

    // Build union of ALL rawData keys across every row (same logic as on-screen table)
    const rawColSet = new Set<string>();
    for (const r of rows) {
      if (r.rawData && typeof r.rawData === "object") {
        for (const k of Object.keys(r.rawData)) rawColSet.add(k);
      }
    }
    const rawCols = Array.from(rawColSet);
    const headers = [...rawCols, "Major Head", "Sub Head", "Entry By", "Matched By", "Status"];

    const data: any[][] = [headers];
    for (const row of rows) {
      const rd = (row.rawData ?? {}) as Record<string, any>;
      data.push([
        ...rawCols.map((c) => { const v = rd[c]; return v === null || v === undefined ? "" : String(v); }),
        row.majorHead ?? "",
        row.subHead   ?? "",
        row.isMatched ? computeEntryBy(row.itemText, row.subHead) : "",
        row.entryBy   ?? "",
        row.isMatched ? "Matched" : "Unmatched",
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FIN14 Transactions");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="FIN14_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "X-Row-Count":         String(rows.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Export failed" }, { status: 500 });
  }
}
