import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

const FIXED = ["Child ID","Child Name","Center","Center ID","Family ID","Family Name"];

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
const CALC_ORDER = [
  "Month Start Date","Month End Date","Total Days in Month","Total Mondays in Month",
  "Final Start Date","Final End Date","Final Days to be Billed","Final Weeks to be Billed",
  "Monthly Fees","Early AM Care Fees","Late PM Care Fees","Program Fees",
  "Gross Billing Amount","Agency Type","Final Billing Amount","Estimated Copay Billing",
  "Agency Billing","Copay Billing","Customer Liability",
  "Final Agency Billing","Final Copay","Final Customer Liability","Final Expected Billing",
];
const KNOWN_SET = new Set([...FIXED, ...FC28_ORDER, ...RATE_SHEET_ORDER, ...AGENCY_ORDER, ...CALC_ORDER]);

// GET /api/child-billing/columns — returns all available columns grouped
export async function GET() {
  try {
    const batch = await db.childBillingBatch.findFirst({ orderBy: { createdAt: "desc" } });
    if (!batch) return NextResponse.json({ groups: [] });

    // Sample up to 500 rows to discover rawData keys
    const rows: { rawData: Record<string, any> }[] = await prisma.$queryRawUnsafe(
      `SELECT "rawData" FROM "ChildBillingRow" WHERE "batchId"=$1 LIMIT 500`, batch.id
    );

    const presentSet = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row.rawData ?? {})) presentSet.add(k);
    }

    const fin14Cols = Array.from(presentSet).filter(c => !KNOWN_SET.has(c)).sort();

    const groups = [
      { label: "Identity",    cols: FIXED },
      { label: "FIN14 Data",  cols: fin14Cols },
      { label: "FC28",        cols: FC28_ORDER.filter(c => presentSet.has(c)) },
      { label: "Rate Sheet",  cols: RATE_SHEET_ORDER.filter(c => presentSet.has(c)) },
      { label: "Agency",      cols: AGENCY_ORDER.filter(c => presentSet.has(c)) },
      { label: "Calculation", cols: CALC_ORDER.filter(c => presentSet.has(c)) },
    ].filter(g => g.cols.length > 0);

    return NextResponse.json({ groups });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
