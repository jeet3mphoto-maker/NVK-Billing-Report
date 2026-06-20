import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";

  try {
    let data: Record<string, any>[] = [];
    let sheetName = "Report";

    switch (reportId) {
      case "billed-vs-expected": {
        const facts = await prisma.billingFact.findMany({
          include: { child: true, center: true, family: true },
          take: 1000,
          orderBy: { billingPeriod: "desc" },
        });
        data = facts.map(f => ({
          "Child ID": f.child.childId,
          "Child Name": f.child.fullName,
          "Family ID": f.family.familyId,
          "Center": f.center.name,
          "Billing Period": f.billingPeriod,
          "Expected Amount": Number(f.expectedAmount),
          "Actual Amount": Number(f.actualAmount),
          "Variance": Number(f.varianceAmount),
          "Variance %": Number(f.variancePercent),
          "Status": f.billingStatus,
        }));
        sheetName = "Billed vs Expected";
        break;
      }
      case "fc28-change-log": {
        const changes = await prisma.fC28ChangeLog.findMany({
          take: 1000,
          orderBy: { changeDate: "desc" },
        });
        data = changes.map(c => ({
          "Snapshot Date": c.snapshotDate.toISOString().split("T")[0],
          "Child ID": c.childId,
          "Change Type": c.changeType,
          "Field": c.fieldName,
          "Previous Value": c.oldValue ?? "",
          "New Value": c.newValue ?? "",
          "Changed At": c.changeDate.toISOString(),
        }));
        sheetName = "FC28 Change Log";
        break;
      }
      case "monthly-reconciliation": {
        const snaps = await prisma.monthlySnapshot.findMany({
          orderBy: [{ year: "desc" }, { month: "desc" }],
        });
        data = snaps.map(s => ({
          "Period": `${s.year}-${String(s.month).padStart(2,"0")}`,
          "Expected Revenue": Number(s.expectedRevenue),
          "Actual Revenue":   Number(s.actualRevenue),
          "Collected Revenue":Number(s.collectedRevenue),
          "Outstanding":      Number(s.outstandingRevenue),
          "Variance":         Number(s.varianceAmount),
          "Leakage":          Number(s.leakageAmount),
          "Active Children":  s.activeChildren,
        }));
        sheetName = "Monthly Reconciliation";
        break;
      }
      default:
        data = [{ note: `${reportId} report - connect database for live data` }];
    }

    if (format === "csv") {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${reportId}.csv"`,
        },
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${reportId}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
