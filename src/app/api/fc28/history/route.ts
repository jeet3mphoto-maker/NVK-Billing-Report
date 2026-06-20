import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

const db = prisma as any;

// GET /api/fc28/history — exports all FC28 records from DB as a consolidated Excel download
export async function GET() {
  try {
    const records = await db.fC28Record.findMany({
      orderBy: [{ childId: "asc" }, { reportDate: "asc" }],
    });

    if (records.length === 0) {
      return NextResponse.json({ error: "No FC28 records in database. Upload FC28 files first." }, { status: 404 });
    }

    const outputRows = records.map((r: any) => ({
      "FC28 Report Date": r.reportDate.toISOString().slice(0, 10),
      "Child ID":         r.childId,
      "Child Name":       r.childName       ?? "",
      "Center ID":        r.centerId        ?? "",
      "Center":           r.center          ?? "",
      "Family ID":        r.familyId        ?? "",
      "Family":           r.family          ?? "",
      "Child Status":     r.childStatus     ?? "",
      "Family Status":    r.familyStatus    ?? "",
      "Classroom":        r.classroom       ?? "",
      "Rate Sheet":       r.rateSheet       ?? "",
      "Date of Birth":    r.dateOfBirth     ?? "",
      "Enroll Date":      r.enrollDate      ?? "",
      "Start Date":       r.startDate       ?? "",
      "Program":          r.program         ?? "",
      "Billing Cycle":    r.billingCycle    ?? "",
      "Agency":           r.agency          ?? "",
      "Est. Contract Amt": r.estimatedContractAmount != null ? Number(r.estimatedContractAmount) : "",
    }));

    const ws = XLSX.utils.json_to_sheet(outputRows);
    const keys = Object.keys(outputRows[0] ?? {});
    ws["!cols"] = keys.map((k) => ({
      wch: Math.max(k.length, ...outputRows.slice(0, 100).map((r: any) => String(r[k] ?? "").length), 8),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FC28 History");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `FC28_History_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Row-Count":         String(records.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
