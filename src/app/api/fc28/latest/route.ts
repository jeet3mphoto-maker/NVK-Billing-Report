import { NextResponse } from "next/server";
import { getLatestFC28PerChild } from "@/lib/fc28-history";

// GET /api/fc28/latest — returns latest FC28 record per Child ID as JSON
export async function GET() {
  try {
    const map = getLatestFC28PerChild();
    const data: Record<string, any> = {};
    for (const [cid, row] of map.entries()) {
      data[cid] = {
        startDate:      row["Start Date"] ?? "",
        dob:            row["Date of Birth"] ?? "",
        withdrawalDate: row["Withdrawal Date"] ?? "",
        billingCycle:   row["Billing Cycle"] ?? "",
        childStatus:    row["Child Status"] ?? "",
        reportDate:     row["FC28 Report Date"] ?? "",
      };
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
