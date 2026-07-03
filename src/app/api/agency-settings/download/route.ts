import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export async function GET() {
  try {
    const batch = await db.agencySettingBatch.findFirst({ orderBy: { uploadedAt: "desc" } });
    if (!batch) return NextResponse.json({ error: "No agency settings data found" }, { status: 404 });

    const rows = await db.agencySetting.findMany({
      where:   { batchId: batch.id },
      orderBy: [{ name: "asc" }, { center: "asc" }],
    });

    const XLSX = await import("xlsx");

    const wsData = [
      ["Name", "Center", "Active", "Contract Period", "Type", "Use Blackout Dates", "Discounts Permitted"],
      ...rows.map((r: any) => [
        r.name ?? "",
        r.center ?? "",
        r.active ?? "",
        r.contractPeriod ?? "",
        r.type ?? "",
        r.useBlackoutDates ?? "",
        r.discountsPermitted ?? "",
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = [
      { wch: 35 }, { wch: 30 }, { wch: 10 }, { wch: 18 },
      { wch: 20 }, { wch: 20 }, { wch: 25 },
    ];

    // Freeze header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, "Agency Settings");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const dateStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="AgencySettings_${dateStr}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Download failed" }, { status: 500 });
  }
}
