import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const db = prisma as any;

function parseMoney(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val).replace(/[$, ]/g, "").replace(/\((.+)\)/, "-$1");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function cell(v: any, t: XLSX.ExcelDataType, z?: string): XLSX.CellObject {
  const c: XLSX.CellObject = { v, t };
  if (z) c.z = z;
  return c;
}

// Row-dimension fields (left side of pivot)
const ROW_FIELDS = [
  { label: "Child ID",        wch: 11, key: (r: any) => String(r.rawData?.["Child ID"]               ?? "") },
  { label: "Child Name",      wch: 24, key: (r: any) => String(r.rawData?.["Child Name"]             ?? "") },
  { label: "Center",          wch: 22, key: (r: any) => String(r.rawData?.["Center"]                 ?? "") },
  { label: "Billing Cycle",   wch: 14, key: (r: any) => String(r.rawData?.["Billing Cycle (FC28)"]   ?? r.rawData?.["Billing Cycle"] ?? "") },
  { label: "Child Status",    wch: 13, key: (r: any) => String(r.rawData?.["Child Status (FC28)"]    ?? "") },
  { label: "Start Date",      wch: 13, key: (r: any) => String(r.rawData?.["Start Date (FC28)"]      ?? "") },
  { label: "Withdrawal Date", wch: 16, key: (r: any) => String(r.rawData?.["Withdrawal Date (FC28)"] ?? "") },
  { label: "Classroom",       wch: 14, key: (r: any) => String(r.rawData?.["Classroom (FC28)"]       ?? "") },
  { label: "Family Status",   wch: 13, key: (r: any) => String(r.rawData?.["Family Status (FC28)"]   ?? "") },
];

const MAJOR_ORDER = ["Billing", "Adjustments", "Payment"];
const SUB_ORDER: Record<string, string[]> = {
  Billing:     ["Regular", "Agency", "Early/Late", "One Time", "Other"],
  Adjustments: ["Adjustments", "Discount"],
  Payment:     ["Agency"],
};
const NUM_FMT = "#,##0.00";

export async function GET(req: NextRequest) {
  try {
    const sp      = new URL(req.url).searchParams;
    const batchId = sp.get("batchId");

    const where: any = {};
    if (batchId) where.batchId = batchId;

    const rows = await db.fin14Row.findMany({ where, orderBy: { id: "asc" } });
    if (rows.length === 0) {
      return NextResponse.json({ error: "No FIN14 rows found" }, { status: 404 });
    }

    // ── Step 1: Filter ────────────────────────────────────────────────────────
    const filtered = rows.filter((r: any) => {
      const fn  = String(r.rawData?.["Family Name"] ?? "").trim();
      if (!fn || fn === "—" || fn === "-") return false;
      const cid = String(r.rawData?.["Child ID"]   ?? "").trim();
      if (!cid || cid === "—" || cid === "-") return false;
      return true;
    });
    const excluded = rows.length - filtered.length;

    // ── Step 2: Determine columns ─────────────────────────────────────────────
    const colSet = new Set<string>();
    for (const r of filtered) {
      if (r.majorHead && r.subHead) colSet.add(`${r.majorHead}|||${r.subHead}`);
    }
    const allCols: { major: string; sub: string; label: string }[] = [];
    for (const major of MAJOR_ORDER) {
      for (const sub of SUB_ORDER[major] ?? []) {
        if (colSet.has(`${major}|||${sub}`)) allCols.push({ major, sub, label: `${major}: ${sub}` });
      }
    }
    for (const key of colSet) {
      const [major, sub] = key.split("|||");
      if (!allCols.find((c) => c.major === major && c.sub === sub))
        allCols.push({ major, sub, label: `${major}: ${sub}` });
    }

    // ── Step 3: Build pivot — ONE row per Child ID ───────────────────────────
    type PivotRow = { rowValues: string[]; totals: Map<string, number> };
    const pivotMap = new Map<string, PivotRow>();

    for (const r of filtered) {
      const childId = String(r.rawData?.["Child ID"] ?? "").trim();
      const colKey  = `${r.majorHead}|||${r.subHead}`;
      const amount  = parseMoney(r.rawData?.["Amount"]);

      if (!pivotMap.has(childId)) {
        pivotMap.set(childId, { rowValues: ROW_FIELDS.map((f) => f.key(r)), totals: new Map() });
      }
      const entry = pivotMap.get(childId)!;
      entry.totals.set(colKey, (entry.totals.get(colKey) ?? 0) + amount);
    }

    // ── Step 4: Sort by Center (A→Z) then numeric Child ID ───────────────────
    const sortedEntries = [...pivotMap.entries()].sort(([cidA, a], [cidB, b]) => {
      const centerA = a.rowValues[2].toLowerCase();
      const centerB = b.rowValues[2].toLowerCase();
      if (centerA !== centerB) return centerA < centerB ? -1 : 1;
      return (Number(cidA) || 0) - (Number(cidB) || 0);
    });

    // ── Step 5: Compute subtotals ─────────────────────────────────────────────
    // Per column totals
    const colTotals = new Map<string, number>();
    let grandTotal = 0;
    for (const [, { totals }] of sortedEntries) {
      for (const col of allCols) {
        const k = `${col.major}|||${col.sub}`;
        const v = totals.get(k) ?? 0;
        colTotals.set(k, (colTotals.get(k) ?? 0) + v);
        grandTotal += v;
      }
    }

    // Per major group totals
    const majorTotals: Record<string, number> = {};
    for (const major of MAJOR_ORDER) majorTotals[major] = 0;
    for (const col of allCols) {
      majorTotals[col.major] = (majorTotals[col.major] ?? 0) + (colTotals.get(`${col.major}|||${col.sub}`) ?? 0);
    }

    // ── Step 6: Build worksheet ───────────────────────────────────────────────
    const ws: XLSX.WorkSheet = {};
    const numMeta  = ROW_FIELDS.length;
    const numVal   = allCols.length;
    const totalCol = numMeta + numVal;      // Grand Total column index
    const lastCol  = totalCol;              // last column index

    // ── Summary block (rows 0–7) ──────────────────────────────────────────────
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    // Row 0: Report title
    ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = cell("ASA Billing Intelligence — FIN14 Final Report", "s");

    // Row 1: Generated date
    ws[XLSX.utils.encode_cell({ r: 1, c: 0 })] = cell(`Generated: ${today}`, "s");

    // Row 2: blank
    // Row 3: KPI labels
    const kpis = [
      ["Total Children", sortedEntries.length],
      ["FIN14 Rows Used", filtered.length],
      ["Rows Excluded", excluded],
    ];
    kpis.forEach(([label, val], i) => {
      ws[XLSX.utils.encode_cell({ r: 3, c: i * 2 })]     = cell(label, "s");
      ws[XLSX.utils.encode_cell({ r: 3, c: i * 2 + 1 })] = cell(val,   "n");
    });

    // Row 4: blank
    // Row 5: Major group total labels
    ws[XLSX.utils.encode_cell({ r: 5, c: 0 })] = cell("Amount Summary", "s");
    [...MAJOR_ORDER, "Grand Total"].forEach((label, i) => {
      ws[XLSX.utils.encode_cell({ r: 5, c: i + 1 })] = cell(label, "s");
    });
    // Row 6: Major group total values
    ws[XLSX.utils.encode_cell({ r: 6, c: 0 })] = cell("Total", "s");
    MAJOR_ORDER.forEach((major, i) => {
      ws[XLSX.utils.encode_cell({ r: 6, c: i + 1 })] = cell(majorTotals[major] ?? 0, "n", NUM_FMT);
    });
    ws[XLSX.utils.encode_cell({ r: 6, c: MAJOR_ORDER.length + 1 })] = cell(grandTotal, "n", NUM_FMT);

    // Row 7: blank separator

    // ── Table header (rows 8–9): Major Head | Sub Head ───────────────────────
    const HDR1 = 8;   // Major Head row
    const HDR2 = 9;   // Sub Head row (autofilter row)

    // Meta column headers (span both header rows via same label in row 8; blank in row 9)
    ROW_FIELDS.forEach((f, ci) => {
      ws[XLSX.utils.encode_cell({ r: HDR1, c: ci })] = cell(f.label, "s");
      ws[XLSX.utils.encode_cell({ r: HDR2, c: ci })] = cell("",      "s");
    });

    // Value column headers
    allCols.forEach((col, ci) => {
      const c = numMeta + ci;
      ws[XLSX.utils.encode_cell({ r: HDR1, c })] = cell(col.major, "s");
      ws[XLSX.utils.encode_cell({ r: HDR2, c })] = cell(col.sub,   "s");
    });

    // Grand Total header
    ws[XLSX.utils.encode_cell({ r: HDR1, c: totalCol })] = cell("Grand Total", "s");
    ws[XLSX.utils.encode_cell({ r: HDR2, c: totalCol })] = cell("",            "s");

    // ── Data rows (starting row 10) ───────────────────────────────────────────
    const DATA_START = 10;
    let ri = DATA_START;

    for (const [, { rowValues, totals }] of sortedEntries) {
      // Meta cells
      rowValues.forEach((v, ci) => {
        ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = cell(v, "s");
      });
      // Child ID as number if possible
      const cidNum = Number(rowValues[0]);
      if (!isNaN(cidNum) && rowValues[0] !== "") {
        ws[XLSX.utils.encode_cell({ r: ri, c: 0 })] = cell(cidNum, "n");
      }

      // Value cells + row grand total
      let rowTotal = 0;
      allCols.forEach((col, ci) => {
        const v = totals.get(`${col.major}|||${col.sub}`) ?? 0;
        ws[XLSX.utils.encode_cell({ r: ri, c: numMeta + ci })] = cell(v, "n", NUM_FMT);
        rowTotal += v;
      });
      ws[XLSX.utils.encode_cell({ r: ri, c: totalCol })] = cell(rowTotal, "n", NUM_FMT);
      ri++;
    }

    // ── Grand Totals row ──────────────────────────────────────────────────────
    ws[XLSX.utils.encode_cell({ r: ri, c: 0 })] = cell("GRAND TOTAL", "s");
    allCols.forEach((col, ci) => {
      ws[XLSX.utils.encode_cell({ r: ri, c: numMeta + ci })] = cell(colTotals.get(`${col.major}|||${col.sub}`) ?? 0, "n", NUM_FMT);
    });
    ws[XLSX.utils.encode_cell({ r: ri, c: totalCol })] = cell(grandTotal, "n", NUM_FMT);

    // ── Sheet metadata ────────────────────────────────────────────────────────
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ri, c: lastCol } });

    // Autofilter on header row 8 (Major Head row — Excel applies filter to full column range)
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({ s: { r: HDR1, c: 0 }, e: { r: ri, c: lastCol } }),
    };

    // Freeze: top 10 rows (summary + both headers) and first 3 columns
    ws["!freeze"] = { xSplit: 3, ySplit: DATA_START } as any;

    // Column widths
    ws["!cols"] = [
      ...ROW_FIELDS.map((f) => ({ wch: f.wch })),
      ...allCols.map(() => ({ wch: 13 })),
      { wch: 14 },   // Grand Total col
    ];

    // ── Workbook ──────────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Final Report");

    const buf      = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `FIN14_Final_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Total-Rows":        String(rows.length),
        "X-Excluded-Rows":     String(excluded),
        "X-Pivot-Rows":        String(sortedEntries.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Report generation failed" }, { status: 500 });
  }
}
