import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

const db = prisma as any;

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateFromFilename(filename: string): Date | null {
  const m = filename.match(/(\d+)-([a-z]+)-(\d{4})/i);
  if (!m) return null;
  const month = MONTH_MAP[m[2].toLowerCase().slice(0, 3)];
  if (month === undefined) return null;
  return new Date(+m[3], month, +m[1]);
}

function excelDateToString(val: any): string {
  if (!val && val !== 0) return "";
  if (val instanceof Date) {
    const dd = String(val.getDate()).padStart(2, "0");
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${val.getFullYear()}`;
  }
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400000);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return String(val);
}

function safeDecimal(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

// POST /api/fc28/sync — accepts uploaded FC28 Excel files and inserts new records into DB
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Find which report dates are already fully synced in the DB
    const existingDates: { reportDate: Date }[] = await db.fC28Record.findMany({
      select:   { reportDate: true },
      distinct: ["reportDate"],
    });
    const syncedDates = new Set(existingDates.map((r: any) => r.reportDate.toISOString().slice(0, 10)));

    let filesProcessed = 0;
    let filesSkipped   = 0;
    let rowsInserted   = 0;
    let rowsSkipped    = 0;

    for (const file of files) {
      const reportDate = parseDateFromFilename(file.name);
      if (!reportDate) { filesSkipped++; continue; }

      const dateKey = reportDate.toISOString().slice(0, 10);
      if (syncedDates.has(dateKey)) { filesSkipped++; continue; }

      const buffer = Buffer.from(await file.arrayBuffer());
      const wb    = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const ws    = wb.Sheets[wb.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];

      const records = rows.map((row) => ({
        reportDate,
        childId:                 String(row["Child ID"] ?? "").trim(),
        childName:               String(row["Child Name"] ?? "").trim() || null,
        centerId:                row["Center ID"] != null ? Number(row["Center ID"]) : null,
        center:                  String(row["Center"] ?? "").trim() || null,
        familyId:                row["Family ID"] != null ? Number(row["Family ID"]) : null,
        family:                  String(row["Family"] ?? "").trim() || null,
        childStatus:             String(row["Child Status"] ?? "").trim() || null,
        familyStatus:            String(row["Family Status"] ?? "").trim() || null,
        classroom:               String(row["Classroom"] ?? "").trim() || null,
        rateSheet:               String(row["Rate Sheet"] ?? "").trim() || null,
        dateOfBirth:             excelDateToString(row["Date of Birth"]) || null,
        enrollDate:              excelDateToString(row["Enroll Date"]) || null,
        startDate:               excelDateToString(row["Start Date"]) || null,
        program:                 String(row["Program"] ?? "").trim() || null,
        billingCycle:            String(row["Billing Cycle"] ?? "").trim() || null,
        agency:                  String(row["Agency"] ?? "").trim() || null,
        estimatedContractAmount: safeDecimal(row["Estimated Contract Amount"]),
        rawData:                 row,
      })).filter((r) => r.childId);

      if (records.length === 0) { filesSkipped++; continue; }

      const result = await db.fC28Record.createMany({ data: records, skipDuplicates: true });
      rowsInserted += result.count;
      rowsSkipped  += records.length - result.count;
      filesProcessed++;
    }

    const totalInDb = await db.fC28Record.count();

    return NextResponse.json({ success: true, filesProcessed, filesSkipped, rowsInserted, rowsSkipped, totalInDb });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}

// GET /api/fc28/sync — returns current DB stats
export async function GET() {
  try {
    const totalInDb   = await db.fC28Record.count();
    const reportDates = await db.fC28Record.findMany({
      select:   { reportDate: true },
      distinct: ["reportDate"],
      orderBy:  { reportDate: "desc" },
    });
    return NextResponse.json({
      totalInDb,
      syncedDates: reportDates.map((r: any) => r.reportDate.toISOString().slice(0, 10)),
    });
  } catch (err: any) {
    return NextResponse.json({ totalInDb: 0, syncedDates: [], error: err.message });
  }
}
