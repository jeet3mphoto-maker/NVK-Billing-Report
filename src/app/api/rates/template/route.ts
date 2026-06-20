import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    // Standard template columns matching the extraction format
    const templateData = [
      {
        "Entity": "Example Entity",
        "State": "CA",
        "Center": "Example Center 1",
        "Rate Card Version": "2024-V1",
        "Program": "Full Time",
        "Classroom": "Preschool",
        "Drop Off": "08:00 AM",
        "Late Pickup": "06:00 PM",
        "Monthly Fees": 1500.00,
        "Early AM Care Rate": 50.00,
        "Late PM Care Rate": 75.00
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Auto-size columns slightly
    const colWidths = Object.keys(templateData[0]).map((key) => ({
      wch: Math.max(key.length, 15)
    }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Rate Card Master");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="Rate_Card_Upload_Template.xlsx"',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message ?? "Internal error" }, { status: 500 });
  }
}
