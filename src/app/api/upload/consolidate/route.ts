import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

// Entry By formula: ASA if SubHead=Adjustments AND item contains "ASA "/"ASA_"/"ASA-", else CENTER
function computeEntryBy(itemText: string | null, subHead: string | null): string {
  if (subHead === "Adjustments" && itemText) {
    const t = itemText.toUpperCase();
    if (t.includes("ASA ") || t.includes("ASA_") || t.includes("ASA-")) return "ASA";
  }
  return "CENTER";
}

// Find the first matching ItemMaster entry for a given item text.
// Logic mirrors the Excel SEARCH formula: master.item must be a substring of txnItem.
function matchItem(txnItem: string, masters: { id: number; item: string; majorHead: string; subHead: string }[]) {
  if (!txnItem) return null;
  const lower = txnItem.toLowerCase();
  // Sort longer patterns first so more-specific entries win over shorter ones
  const sorted = [...masters].sort((a, b) => b.item.length - a.item.length);
  return sorted.find((m) => lower.includes(m.item.toLowerCase())) ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ success: false, message: "No files provided" }, { status: 400 });
    }

    // Load item master from DB (graceful — may be unavailable if Prisma client not yet regenerated)
    let masters: { id: number; item: string; majorHead: string; subHead: string }[] = [];
    try {
      masters = await (prisma as any).itemMaster.findMany({ where: { isActive: true } });
    } catch {
      // Prisma client needs regeneration — run `node node_modules/prisma/build/index.js generate` then restart dev server
    }

    let headerKeys: string[] = [];
    let allRows: Record<string, any>[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];

      if (rows.length === 0) continue;

      if (headerKeys.length === 0) headerKeys = Object.keys(rows[0]);

      for (const row of rows) {
        const isHeader = headerKeys.some(
          (k) => row[k] !== null && String(row[k] ?? "").trim() === k.trim()
        );
        const isEmpty = headerKeys.every(
          (k) => row[k] === null || row[k] === undefined || String(row[k]).trim() === ""
        );
        if (!isHeader && !isEmpty) allRows.push(row);
      }
    }

    if (allRows.length === 0) {
      return NextResponse.json({ success: false, message: "No data rows found after cleaning" }, { status: 422 });
    }

    // Detect which column holds the item text (case-insensitive match for "item")
    const itemCol = headerKeys.find((k) => k.trim().toLowerCase() === "item") ?? null;

    // Apply item master matching and build output rows
    const outputRows: Record<string, any>[] = [];
    const dbRows: { rawData: any; itemText: string | null; majorHead: string | null; subHead: string | null; entryBy: string | null; isMatched: boolean }[] = [];

    for (const row of allRows) {
      const txnItem = itemCol ? String(row[itemCol] ?? "").trim() : "";
      const match = txnItem ? matchItem(txnItem, masters) : null;

      const majorHead = match?.majorHead ?? null;
      const subHead   = match?.subHead   ?? null;
      const entryBy   = match ? "System" : null;

      // Build master-column-ordered output row + 3 new columns at end
      const out: Record<string, any> = {};
      for (const k of headerKeys) out[k] = row[k] ?? null;
      out["Major Head"] = majorHead ?? "";
      out["Sub Head"]   = subHead   ?? "";
      out["Entry By"]   = computeEntryBy(txnItem, subHead);
      out["Matched By"] = entryBy   ?? "";

      outputRows.push(out);
      dbRows.push({
        rawData:   row,
        itemText:  txnItem || null,
        majorHead,
        subHead,
        entryBy,
        isMatched: !!match,
      });
    }

    // Save batch + rows to DB (graceful — skip if Prisma client not yet regenerated)
    const matchedCount   = dbRows.filter((r) => r.isMatched).length;
    const unmatchedCount = dbRows.length - matchedCount;

    let batchId = "";
    try {
      const batch = await (prisma as any).fin14Batch.create({
        data: {
          fileCount:      files.length,
          rowCount:       dbRows.length,
          matchedCount,
          unmatchedCount,
          rows: { create: dbRows },
        },
      });
      batchId = batch.id;
    } catch {
      // Will work after Prisma client regeneration + dev server restart
    }

    // Build Excel
    const ws = XLSX.utils.json_to_sheet(outputRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidated");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="FIN14_Consolidated.xlsx"`,
        "X-Row-Count":       String(allRows.length),
        "X-File-Count":      String(files.length),
        "X-Matched-Count":   String(matchedCount),
        "X-Unmatched-Count": String(unmatchedCount),
        "X-Batch-Id":        batchId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message ?? "Internal error" }, { status: 500 });
  }
}
