import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const db = prisma as any;

const FC28_COLS = [
  "Child Status (FC28)","Family Status (FC28)","Classroom (FC28)","Rate Sheet (FC28)",
  "Date of Birth (FC28)","Enroll Date (FC28)","Start Date (FC28)","Withdrawal Date (FC28)",
  "Withdrawal Reason (FC28)","Primary Guardian (FC28)",
  "Mon (FC28)","Tue (FC28)","Wed (FC28)","Thu (FC28)","Fri (FC28)",
  "Drop Off (FC28)","Pickup (FC28)","Early AM Care (FC28)","Late PM Care (FC28)","Program (FC28)",
  "Discount Type (FC28)","Discount Name (FC28)","Main Discount (FC28)","AM/PM Discount (FC28)","Total Discount (FC28)",
  "Billing Cycle (FC28)",
  "Agency 1 (FC28)","Family Contrib 1 (FC28)","Contract Amt 1 (FC28)","Contract Period 1 (FC28)","Copay Amt 1 (FC28)","Copay Period 1 (FC28)",
  "Agency 2 (FC28)","Contract Amt 2 (FC28)","Contract Period 2 (FC28)","Copay Amt 2 (FC28)","Copay Period 2 (FC28)",
  "Rate Card Key (FC28)","Revised Classroom (FC28)","Early AM Rate Card Key (FC28)","Late PM Rate Card Key (FC28)",
];

const CALC_COLS = [
  "Month Start Date","Month End Date","Total Days in Month","Total Mondays in Month",
  "Final Start Date","Final End Date","Final Days to be Billed","Final Weeks to be Billed",
  "Early AM Care Fees","Late PM Care Fees","Gross Billing Amount","Agency Type",
  "Final Billing Amount","Final Agency Billing","Estimated Copay Billing",
];

// GET /api/child-billing/export?cols=col1,col2,...
export async function GET(req: NextRequest) {
  try {
    const batch = await db.childBillingBatch.findFirst({ orderBy: { createdAt: "desc" } });
    if (!batch) return NextResponse.json({ error: "No child billing data found" }, { status: 404 });

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "childId","childName","center","centerId","familyId","familyName","rawData"
       FROM "ChildBillingRow" WHERE "batchId"=$1 ORDER BY center,"childName"`,
      batch.id
    );
    if (!rows.length) return NextResponse.json({ error: "No rows to export" }, { status: 404 });

    const selectedCols = new URL(req.url).searchParams.get("cols");
    const selectedSet  = selectedCols ? new Set(selectedCols.split(",").map(c => c.trim()).filter(Boolean)) : null;

    // Collect all distinct rawData keys to find billing head columns
    const knownSet = new Set([...FC28_COLS, ...CALC_COLS]);
    const headColsSet = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row.rawData ?? {})) {
        if (!knownSet.has(k)) headColsSet.add(k);
      }
    }
    const headCols = Array.from(headColsSet).sort();

    const fixedHeaders  = ["Child ID","Child Name","Center","Center ID","Family ID","Family Name"];
    const allRawPresent = (cols: string[]) => cols.filter(c => rows.some(r => (r.rawData??{})[c] != null));

    const allHeaders = [
      ...fixedHeaders,
      ...headCols,
      ...allRawPresent(FC28_COLS),
      ...allRawPresent(CALC_COLS),
    ];
    const headers = selectedSet ? allHeaders.filter(h => selectedSet.has(h)) : allHeaders;

    const data: any[][] = [headers];
    for (const row of rows) {
      const rd = (row.rawData ?? {}) as Record<string,any>;
      data.push([
        row.childId   ?? "", row.childName  ?? "",
        row.center    ?? "", row.centerId   ?? "",
        row.familyId  ?? "", row.familyName ?? "",
        ...headCols.map(c => { const v = rd[c]; return v == null ? "" : v; }),
        ...allRawPresent(FC28_COLS).map(c => { const v = rd[c]; return v == null ? "" : String(v); }),
        ...allRawPresent(CALC_COLS).map(c => { const v = rd[c]; return v == null ? "" : v; }),
      ]);
    }

    const xlsxMod = await import("xlsx");
    const XLSX = (xlsxMod as any).default ?? xlsxMod;
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expected vs Actual");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ExpectedActual_${new Date().toISOString().slice(0,10)}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Export failed" }, { status: 500 });
  }
}
