import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const maxDuration = 120;

const db = prisma as any;

// All available columns with display labels
export const FC28_COLUMNS = [
  { key: "center",          label: "Center" },
  { key: "centerId",        label: "Center ID" },
  { key: "childId",         label: "Child ID" },
  { key: "childName",       label: "Child Name" },
  { key: "familyName",      label: "Family Name" },
  { key: "familyId",        label: "Family ID" },
  { key: "childStatus",     label: "Child Status" },
  { key: "familyStatus",    label: "Family Status" },
  { key: "classroom",       label: "Classroom" },
  { key: "rateSheet",       label: "Rate Sheet" },
  { key: "dateOfBirth",     label: "Date of Birth" },
  { key: "enrollDate",      label: "Enroll Date" },
  { key: "startDate",       label: "Start Date" },
  { key: "withdrawalDate",  label: "Withdrawal Date" },
  { key: "withdrawalReason",label: "Withdrawal Reason" },
  { key: "primaryGuardian", label: "Primary Guardian" },
  { key: "monDay",          label: "Mon" },
  { key: "tueDay",          label: "Tue" },
  { key: "wedDay",          label: "Wed" },
  { key: "thuDay",          label: "Thu" },
  { key: "friDay",          label: "Fri" },
  { key: "address1",        label: "Address 1" },
  { key: "address2",        label: "Address 2" },
  { key: "city",            label: "City" },
  { key: "state",           label: "State" },
  { key: "zipCode",         label: "Zip Code" },
  { key: "program",         label: "Program" },
  { key: "dropOff",         label: "Drop Off" },
  { key: "pickup",          label: "Pickup" },
  { key: "earlyAMCare",     label: "Early AM Care" },
  { key: "latePMCare",      label: "Late PM Care" },
  { key: "discountType",    label: "Discount Type" },
  { key: "discountName",    label: "Discount Name" },
  { key: "mainDiscount",    label: "Main Discount" },
  { key: "amPmDiscount",    label: "AM/PM Discount" },
  { key: "totalDiscount",   label: "Total Discount" },
  { key: "billingCycle",    label: "Billing Cycle" },
  { key: "agency1",         label: "Agency 1" },
  { key: "familyContrib1",  label: "Family Contribution 1" },
  { key: "contractAmt1",    label: "Contract Amount 1" },
  { key: "contractPeriod1", label: "Contract Period 1" },
  { key: "copayAmt1",       label: "Copay Amount 1" },
  { key: "copayPeriod1",    label: "Copay Period 1" },
  { key: "agency2",         label: "Agency 2" },
  { key: "familyContrib2",  label: "Family Contribution 2" },
  { key: "contractAmt2",    label: "Contract Amount 2" },
  { key: "contractPeriod2", label: "Contract Period 2" },
  { key: "copayAmt2",       label: "Copay Amount 2" },
  { key: "copayPeriod2",    label: "Copay Period 2" },
  { key: "sourceFile",      label: "Source File" },
];

// GET /api/fc28/download?batchId=...&cols=center,childId,...
export async function GET(req: NextRequest) {
  try {
    const sp      = new URL(req.url).searchParams;
    const batchId = sp.get("batchId");
    const colsParam = sp.get("cols");

    if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

    // Determine columns to export
    const selectedKeys = colsParam
      ? colsParam.split(",").map(c => c.trim()).filter(Boolean)
      : FC28_COLUMNS.map(c => c.key);

    const validCols = FC28_COLUMNS.filter(c => selectedKeys.includes(c.key));
    if (!validCols.length) return NextResponse.json({ error: "No valid columns" }, { status: 400 });

    // Fetch rows
    const rows = await db.fC28Row.findMany({
      where:   { batchId },
      orderBy: [{ center: "asc" }, { childName: "asc" }],
    });

    if (!rows.length) return NextResponse.json({ error: "No rows found for this batch" }, { status: 404 });

    // Build Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("FC28 Data", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    });

    const navy  = "FF003887";
    const white = "FFFFFFFF";

    ws.columns = validCols.map(c => ({
      width: c.key === "childName" || c.key === "familyName" ? 24
           : c.key.includes("program") || c.key.includes("Guardian") ? 28
           : c.key === "center" ? 22
           : c.key.includes("Day") ? 6
           : 14,
    }));

    // Header row
    const hRow = ws.addRow(validCols.map(c => c.label));
    hRow.height = 18;
    hRow.eachCell(cell => {
      cell.font      = { bold: true, size: 9, color: { argb: white } };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: validCols.length } };

    // Data rows — bulk insert
    const dataRows = rows.map((r: any) =>
      validCols.map(c => {
        const v = r[c.key];
        if (v === null || v === undefined) return "";
        if (typeof v === "boolean") return v ? "Yes" : "No";
        return v;
      })
    );
    ws.addRows(dataRows);

    // Style amount columns
    const amtKeys = ["contractAmt1", "contractAmt2", "copayAmt1", "copayAmt2",
                     "mainDiscount", "amPmDiscount", "totalDiscount", "familyContrib1", "familyContrib2"];
    validCols.forEach((c, i) => {
      if (amtKeys.includes(c.key)) ws.getColumn(i + 1).numFmt = "#,##0.00";
    });

    const buf      = await wb.xlsx.writeBuffer();
    const batch    = await db.fC28Batch.findUnique({ where: { id: batchId } });
    const dateStr  = batch?.reportDate
      ? new Date(batch.reportDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const filename = `FC28_${dateStr}.xlsx`;

    return new NextResponse(buf as Buffer, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Download failed" }, { status: 500 });
  }
}
