import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const CHILD_FIXED_COLS = [
  "Center", "Center ID", "Family Name", "Family ID", "Child Name", "Child ID",
  "Child Status (FC28)", "Family Status (FC28)", "Classroom (FC28)",
  "Date of Birth (FC28)", "Start Date (FC28)", "Withdrawal Date (FC28)",
  "Withdrawal Reason (FC28)", "Billing Cycle (FC28)",
];

export async function GET(req: NextRequest) {
  try {
    const colsParam   = new URL(req.url).searchParams.get("cols");
    const selectedCols = colsParam ? colsParam.split(",").map(c => c.trim()).filter(Boolean) : null;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "rawData","majorHead","subHead","isMatched","entryBy","itemText"
       FROM "Fin14Row"
       ORDER BY "rawData"->>'Center', "rawData"->>'Child ID', "rawData"->>'Date'`
    );

    if (!rows.length) return NextResponse.json({ error: "No FIN14 data" }, { status: 404 });

    const xlsxMod = await import("xlsx");
    const XLSX    = (xlsxMod as any).default ?? xlsxMod;

    // ── Sheet 1: Detail ────────────────────────────────────────────────────
    // Discover all rawData keys (to build default column list)
    const allRawKeys = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row.rawData ?? {})) allRawKeys.add(k);
    }
    const specialCols = ["Status", "Major Head", "Sub Head", "Entry By"];
    const defaultCols = [...specialCols, ...Array.from(allRawKeys)];
    const sheetCols   = selectedCols ?? defaultCols;

    const sheet1Data: any[][] = [sheetCols];
    for (const row of rows) {
      const rd = row.rawData ?? {};
      sheet1Data.push(sheetCols.map(col => {
        if (col === "Status")     return row.isMatched ? (row.entryBy === "System" ? "System" : "Manual") : "Unmatched";
        if (col === "Major Head") return row.majorHead ?? "";
        if (col === "Sub Head")   return row.subHead   ?? "";
        if (col === "Entry By")   return row.entryBy   ?? "";
        const v = rd[col];
        return v == null ? "" : v;
      }));
    }

    // ── Sheet 2: Child Summary (pivot) ─────────────────────────────────────
    // Find all unique Major Head / Sub Head combos
    const comboSet = new Set<string>();
    for (const row of rows) {
      if (row.majorHead && row.subHead) comboSet.add(`${row.majorHead} / ${row.subHead}`);
    }
    const comboCols = Array.from(comboSet).sort();

    // Group rows by Child ID
    const childMap = new Map<string, { fixed: Record<string, any>; amounts: Record<string, number> }>();

    for (const row of rows) {
      const rd      = row.rawData ?? {};
      const childId = String(rd["Child ID"] ?? "");

      if (!childMap.has(childId)) {
        const fixed: Record<string, any> = {};
        for (const col of CHILD_FIXED_COLS) fixed[col] = rd[col] ?? "";
        childMap.set(childId, { fixed, amounts: {} });
      }

      if (row.majorHead && row.subHead) {
        const combo = `${row.majorHead} / ${row.subHead}`;
        const raw   = String(rd["Amount"] ?? rd["amount"] ?? "0");
        const amt   = parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0;
        const entry = childMap.get(childId)!;
        entry.amounts[combo] = (entry.amounts[combo] ?? 0) + amt;
      }
    }

    const sheet2Headers = [...CHILD_FIXED_COLS, ...comboCols];
    const sheet2Data: any[][] = [sheet2Headers];
    for (const [, entry] of childMap) {
      sheet2Data.push([
        ...CHILD_FIXED_COLS.map(col => entry.fixed[col] ?? ""),
        ...comboCols.map(combo => entry.amounts[combo] ?? 0),
      ]);
    }

    // ── Build workbook ─────────────────────────────────────────────────────
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    ws1["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws1["!cols"]   = sheetCols.map(h => ({ wch: Math.max((h as string).length + 2, 14) }));

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2["!freeze"] = { xSplit: 6, ySplit: 1 };
    ws2["!cols"]   = sheet2Headers.map(h => ({ wch: Math.max(h.length + 2, 16) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "FIN14 Detail");
    XLSX.utils.book_append_sheet(wb, ws2, "Child Summary");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="FIN14_WithFC28_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Export failed" }, { status: 500 });
  }
}
