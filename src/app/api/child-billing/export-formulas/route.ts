import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;
const db = prisma as any;

// Convert 0-based column index to Excel letter (A, B, ... Z, AA, AB, ...)
function colLetter(n: number): string {
  let result = ""; n++;
  while (n > 0) { n--; result = String.fromCharCode(65 + (n % 26)) + result; n = Math.floor(n / 26); }
  return result;
}

const FC28_ORDER = [
  "Child Status (FC28)","Family Status (FC28)","Classroom (FC28)","Rate Sheet (FC28)",
  "Date of Birth (FC28)","Enroll Date (FC28)","Start Date (FC28)","Withdrawal Date (FC28)",
  "Withdrawal Reason (FC28)","Primary Guardian (FC28)",
  "Mon (FC28)","Tue (FC28)","Wed (FC28)","Thu (FC28)","Fri (FC28)",
  "Drop Off (FC28)","Pickup (FC28)","Early AM Care (FC28)","Late PM Care (FC28)","Program (FC28)",
  "Discount Type (FC28)","Discount Name (FC28)","Main Discount (FC28)","AM/PM Discount (FC28)","Total Discount (FC28)",
  "Billing Cycle (FC28)",
  "Agency 1 (FC28)","Family Contrib 1 (FC28)","Estimated Contract Amount 1 (FC28)","Contract Period 1 (FC28)","Copay Amt 1 (FC28)","Copay Period 1 (FC28)",
  "Agency 2 (FC28)","Family Contrib 2 (FC28)","Estimated Contract Amount 2 (FC28)","Contract Period 2 (FC28)","Copay Amt 2 (FC28)","Copay Period 2 (FC28)",
  "Rate Card Key (FC28)","Revised Classroom (FC28)","Early AM Rate Card Key (FC28)","Late PM Rate Card Key (FC28)",
];

const RATE_SHEET_ORDER = ["Item Name (Rate Sheet)","Item Value (Rate Sheet)","Core Weekly Logic"];

const AGENCY_ORDER = [
  "Agency Name","Estimated Contract Amount",
  "Agency 1 - Revised Agency Name","Agency 1 - Agency Name (Agency)","Agency 1 - Contract Period (Agency)","Agency 1 - Agency Type (Agency)","Agency 1 - Agency Active","Agency 1 - Use Blackout Dates","Agency 1 - Discounts Permitted",
  "Agency 2 - Revised Agency Name","Agency 2 - Agency Name (Agency)","Agency 2 - Contract Period (Agency)","Agency 2 - Agency Type (Agency)","Agency 2 - Agency Active","Agency 2 - Use Blackout Dates","Agency 2 - Discounts Permitted",
];

// Columns written by Calculate Monthly as plain values
const CALC_VALUE_COLS = [
  "Month Start Date","Month End Date","Total Days in Month","Total Mondays in Month",
  "Final Start Date","Final End Date","Final Days to be Billed","Final Weeks to be Billed",
  "Monthly Fees","Early AM Care Fees","Late PM Care Fees",
  "Gross Billing Amount","Agency Type","Final Billing Amount","Estimated Copay Billing",
];

// Columns that will be replaced with Excel formulas
const FORMULA_COLS = [
  "Program Fees",
  "Agency Billing",
  "Copay Billing",
  "Customer Liability",
  "Final Agency Billing",
  "Final Copay",
  "Final Customer Liability",
  "Final Expected Billing",
];

const FIXED = ["Child ID","Child Name","Center","Center ID","Family ID","Family Name"];
const KNOWN_SET = new Set([...FIXED, ...FC28_ORDER, ...RATE_SHEET_ORDER, ...AGENCY_ORDER, ...CALC_VALUE_COLS, ...FORMULA_COLS]);

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

    // Dynamic FIN14 billing head columns (anything in rawData not in our known set)
    const headColsSet = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row.rawData ?? {})) {
        if (!KNOWN_SET.has(k)) headColsSet.add(k);
      }
    }
    const headCols = Array.from(headColsSet).sort();

    // Ordered full column list
    const allCols = [...FIXED, ...headCols, ...FC28_ORDER, ...RATE_SHEET_ORDER, ...AGENCY_ORDER, ...CALC_VALUE_COLS, ...FORMULA_COLS];

    // Filter to columns that have data (always include FIXED and FORMULA_COLS)
    const formulaSet = new Set(FORMULA_COLS);
    const fixedSet   = new Set(FIXED);
    const hasData = (col: string) => {
      if (fixedSet.has(col) || formulaSet.has(col)) return true;
      return rows.some(r => {
        const rd = r.rawData ?? {};
        if (col === "Child ID")    return r.childId   != null;
        if (col === "Child Name")  return r.childName  != null;
        if (col === "Center")      return r.center     != null;
        if (col === "Center ID")   return r.centerId   != null;
        if (col === "Family ID")   return r.familyId   != null;
        if (col === "Family Name") return r.familyName != null;
        return rd[col] != null;
      });
    };
    const allHeaders = allCols.filter(hasData);
    const headers = selectedSet ? allHeaders.filter(h => selectedSet.has(h) || formulaSet.has(h) || fixedSet.has(h)) : allHeaders;

    // Column index map
    const colIdx = new Map<string, number>();
    headers.forEach((h, i) => colIdx.set(h, i));

    // Build data array with formula objects for formula columns
    const dataArr: any[][] = [headers];

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rd  = (row.rawData ?? {}) as Record<string, any>;
      const excelRow = ri + 2; // header is row 1, first data row is row 2

      // Returns cell reference string for a named column in this row
      const cf = (col: string): string => {
        const ci = colIdx.get(col);
        return ci !== undefined ? colLetter(ci) + excelRow : '""';
      };
      // Numeric cell ref — wraps in IFERROR(VALUE(...),0) so blanks become 0
      const nv = (col: string): string => {
        const ci = colIdx.get(col);
        if (ci === undefined) return "0";
        return `IFERROR(VALUE(${colLetter(ci) + excelRow}),0)`;
      };

      const rowArr: any[] = headers.map(h => {
        // ── Fixed identity columns ──────────────────────────────────────────
        if (h === "Child ID")    return row.childId    ?? "";
        if (h === "Child Name")  return row.childName  ?? "";
        if (h === "Center")      return row.center     ?? "";
        if (h === "Center ID")   return row.centerId   ?? "";
        if (h === "Family ID")   return row.familyId   ?? "";
        if (h === "Family Name") return row.familyName ?? "";

        // ── Formula columns ─────────────────────────────────────────────────
        if (h === "Program Fees") return {
          f: `${nv("Monthly Fees")}+${nv("Early AM Care Fees")}+${nv("Late PM Care Fees")}`,
          t: "n",
        };

        if (h === "Agency Billing") {
          const an = cf("Agency Name"), cp = cf("Contract Period 1 (FC28)");
          const ca = nv("Estimated Contract Amount"), td = nv("Total Days in Month"), cw = nv("Core Weekly Logic");
          return { t: "n", f:
            `IF(AND(${an}<>"",${cp}="Day"),${ca}*${td},` +
            `IF(AND(${an}<>"",${cp}="Month"),${ca},` +
            `IF(AND(${an}<>"",${cp}="Week"),${ca}*${cw},0)))`,
          };
        }

        if (h === "Copay Billing") {
          const at = cf("Agency 1 - Agency Type (Agency)");
          const cop = nv("Copay Amt 1 (FC28)"), cpp = cf("Copay Period 1 (FC28)");
          const cp  = cf("Contract Period 1 (FC28)"), td = nv("Total Days in Month"), cw = nv("Core Weekly Logic");
          const eligible = `OR(${at}="Copay only",${at}="Copay and Can charge full difference")`;
          return { t: "n", f:
            `IF(AND(${eligible},${cpp}="Day"),${cop}*${td},` +
            `IF(AND(${eligible},${cpp}="Month"),${cop},` +
            `IF(AND(${eligible},${cp}="Week"),${cop}*${cw},0)))`,
          };
        }

        if (h === "Customer Liability") {
          const an = cf("Agency Name"), at = cf("Agency 1 - Agency Type (Agency)");
          const pf = nv("Program Fees"), cb = nv("Copay Billing");
          return { t: "n", f:
            `IF(${an}="",${pf},` +
            `IF(AND(${an}<>"",${at}="Copay and Can charge full difference"),${pf}-${cb},0))`,
          };
        }

        if (h === "Final Agency Billing") {
          const bc = cf("Billing Cycle (FC28)"), fd = nv("Final Days to be Billed");
          const fw = nv("Final Weeks to be Billed"), an = cf("Agency Name");
          const ab = nv("Agency Billing"), cw = nv("Core Weekly Logic"), tm = nv("Total Mondays in Month");
          const monthly = `OR(${bc}="Monthly",${bc}="Semi-Monthly")`;
          return { t: "n", f:
            `IF(AND(${monthly},${fd}=22,${an}<>""),${ab},` +
            `IF(AND(${bc}="Weekly",${fw}=5,${an}<>""),IF(${cw}=0,0,${ab}/${cw}*${tm}),` +
            `IF(AND(${monthly},${fd}<22,${an}<>""),${ab}/21.67*${fd},` +
            `IF(AND(${bc}="Weekly",${fw}<5,${an}<>""),${ab}/21.67*${fd},0))))`,
          };
        }

        if (h === "Final Copay") {
          const bc = cf("Billing Cycle (FC28)"), fd = nv("Final Days to be Billed");
          const fw = nv("Final Weeks to be Billed"), an = cf("Agency Name");
          const cb = nv("Copay Billing"), pf = nv("Program Fees");
          const cw = nv("Core Weekly Logic"), tm = nv("Total Mondays in Month");
          const monthly = `OR(${bc}="Monthly",${bc}="Semi-Monthly")`;
          return { t: "n", f:
            `IF(AND(${monthly},${fd}=22,${an}<>""),${cb},` +
            `IF(AND(${bc}="Weekly",${fw}=5,${an}<>""),IF(${cw}=0,0,${cb}/${cw}*${tm}),` +
            `IF(AND(${monthly},${fd}<22,${an}<>""),${cb}/21.67*${fd},` +
            `IF(AND(${bc}="Weekly",${fw}<5,${an}<>""),${pf}/21.67*${fd},0))))`,
          };
        }

        if (h === "Final Customer Liability") {
          const bc = cf("Billing Cycle (FC28)"), fd = nv("Final Days to be Billed");
          const fw = nv("Final Weeks to be Billed"), cl = nv("Customer Liability");
          const cw = nv("Core Weekly Logic"), tm = nv("Total Mondays in Month");
          const monthly = `OR(${bc}="Monthly",${bc}="Semi-Monthly")`;
          return { t: "n", f:
            `IF(AND(${monthly},${fd}=22),${cl},` +
            `IF(AND(${bc}="Weekly",${fw}=5),IF(${cw}=0,0,${cl}/${cw}*${tm}),` +
            `IF(AND(${monthly},${fd}<22),${cl}/21.67*${fd},` +
            `IF(AND(${bc}="Weekly",${fw}<5),${cl}/21.67*${fd},0))))`,
          };
        }

        if (h === "Final Expected Billing") return {
          f: `${nv("Final Agency Billing")}+${nv("Final Copay")}+${nv("Final Customer Liability")}`,
          t: "n",
        };

        // ── All other rawData columns (plain values) ────────────────────────
        const v = rd[h];
        return v == null ? "" : v;
      });

      dataArr.push(rowArr);
    }

    const xlsxMod = await import("xlsx");
    const XLSX    = (xlsxMod as any).default ?? xlsxMod;
    const ws = XLSX.utils.aoa_to_sheet(dataArr);
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!cols"]   = headers.map(h => ({ wch: h.length > 25 ? 30 : h.length > 15 ? 22 : 14 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expected vs Actual");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ExpectedActual_WithFormulas_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Export failed" }, { status: 500 });
  }
}
