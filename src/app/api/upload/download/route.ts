import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "FIN14" or "FIN02"

  if (type === "FIN14") {
    const transactions = await prisma.transaction.findMany({
      orderBy: [{ centerId: "asc" }, { transactionDate: "asc" }],
      include: {
        center: { select: { name: true } },
        family: { select: { familyId: true } },
        child:  { select: { fullName: true, childId: true } },
      },
    });

    const rows = transactions.map((t) => ({
      "Center":           t.center?.name ?? "",
      "Family ID":        t.family?.familyId ?? "",
      "Child ID":         t.child?.childId ?? "",
      "Child Name":       t.child?.fullName ?? "",
      "Transaction Date": t.transactionDate.toISOString().split("T")[0],
      "Billing Period":   t.billingPeriod ?? "",
      "Item":             t.chargeType ?? "",
      "Major Head":       t.majorHead ?? "",
      "Sub Head":         t.subHead ?? "",
      "Charge":           Number(t.chargeAmount),
      "Credit":           Number(t.creditAmount),
      "Payment":          Number(t.paymentAmount),
      "Adjustment":       Number(t.adjustmentAmount),
      "Balance":          Number(t.balance),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FIN14 Consolidated");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="FIN14_Consolidated_Cleaned.xlsx"`,
      },
    });
  }

  if (type === "FIN02") {
    const rates = await prisma.fin02Rate.findMany({
      orderBy: [{ centerName: "asc" }, { childName: "asc" }],
    });

    const rows = rates.map((r) => ({
      "Center":        r.centerName ?? "",
      "Child Name":    r.childName ?? "",
      "Charge Code":   r.chargeCode ?? "",
      "Description":   r.chargeDescription ?? "",
      "Rate Amount":   Number(r.rateAmount),
      "Frequency":     r.rateFrequency ?? "",
      "Effective Date": r.effectiveDate?.toISOString().split("T")[0] ?? "",
      "End Date":       r.endDate?.toISOString().split("T")[0] ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FIN02 Consolidated");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="FIN02_Consolidated_Cleaned.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
