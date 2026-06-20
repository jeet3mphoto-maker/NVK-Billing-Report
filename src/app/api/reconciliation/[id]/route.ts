import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// GET /api/reconciliation/[id]          → returns run + all lines
// GET /api/reconciliation/[id]?export=1 → returns Excel file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wantExport = req.nextUrl.searchParams.get("export") === "1";

  const recon = await prisma.fin02Reconciliation.findUnique({
    where: { id },
    include: {
      lines: { orderBy: [{ reconcStatus: "asc" }, { centerName: "asc" }, { childName: "asc" }] },
    },
  });

  if (!recon) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!wantExport) {
    return NextResponse.json(recon);
  }

  // ── Excel export ─────────────────────────────────────────────────────────
  const STATUS_LABEL: Record<string, string> = {
    MATCHED: "Matched",
    RATE_MISMATCH: "Rate Mismatch",
    MISSING_FIN14: "Missing in FIN14",
    MISSING_FIN02: "Missing in FIN02",
    NOT_ENROLLED: "Not Enrolled",
    NO_DATA: "No Data",
  };

  const rows = recon.lines.map((l) => ({
    "Recon Status": STATUS_LABEL[l.reconcStatus] ?? l.reconcStatus,
    "Child ID": l.childId ?? "",
    "Family ID": l.familyId ?? "",
    "Child Name": l.childName ?? "",
    Center: l.centerName ?? "",
    Program: l.program ?? "",
    Classroom: l.classroom ?? "",
    "Enrollment Status": l.enrollmentStatus ?? "",
    "Billing Cycle": l.billingCycle ?? "",
    "Agency": l.agencyName ?? "",
    "FIN02 Charge Code": l.fin02ChargeCode ?? "",
    "FIN02 Description": l.fin02Description ?? "",
    "FIN02 Rate": l.fin02Rate?.toNumber() ?? "",
    "FIN02 Frequency": l.fin02Frequency ?? "",
    "Expected (Monthly)": l.expectedAmount?.toNumber() ?? "",
    "FIN14 Actual": l.fin14Amount?.toNumber() ?? "",
    "FIN14 Transactions": l.fin14TxnCount,
    "Variance": l.varianceAmount?.toNumber() ?? "",
    "Variance %": l.variancePercent?.toNumber() ?? "",
    Notes: l.notes ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 22 },
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");

  // Summary sheet
  const summaryRows = [
    { Metric: "Billing Period", Value: recon.billingPeriod },
    { Metric: "Run At", Value: recon.runAt.toISOString() },
    { Metric: "Total Children", Value: recon.totalChildren },
    { Metric: "Matched", Value: recon.matched },
    { Metric: "Rate Mismatch", Value: recon.rateMismatch },
    { Metric: "Missing in FIN14", Value: recon.missingFin14 },
    { Metric: "Missing in FIN02", Value: recon.missingFin02 },
    { Metric: "Not Enrolled", Value: recon.notEnrolled },
    { Metric: "No Data", Value: recon.noData },
    {
      Metric: "Match Rate %",
      Value:
        recon.totalChildren > 0
          ? ((recon.matched / recon.totalChildren) * 100).toFixed(1) + "%"
          : "0%",
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Reconciliation_${recon.billingPeriod}.xlsx"`,
    },
  });
}
