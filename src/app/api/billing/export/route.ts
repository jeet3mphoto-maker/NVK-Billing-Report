import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/** Stream the most recently generated billing report for download. */
export async function GET() {
  try {
    const dir = process.env.UPLOAD_DIR || "C:/Users/Administrator/Downloads/Billing-Report";
    // Prefer the canonical file; fall back to the newest timestamped one.
    let file = path.join(dir, "Calculated_Billing_Report.xlsx");
    if (!fs.existsSync(file)) {
      const candidates = fs.readdirSync(dir)
        .filter((f) => /^Calculated_Billing_Report.*\.xlsx$/.test(f))
        .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m);
      if (!candidates.length) return NextResponse.json({ error: "No report generated yet. Run a calculation first." }, { status: 404 });
      file = path.join(dir, candidates[0].f);
    }
    const buf = fs.readFileSync(file);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${path.basename(file)}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
