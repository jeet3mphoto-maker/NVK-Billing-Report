import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const dataRoot = process.env.UPLOAD_DIR ?? "C:/Users/Administrator/Downloads/Billing-Report";
    const scriptPath = path.join(process.cwd(), "..", "etl", "scan_and_ingest.py");

    // Run the Python ETL scan script
    const result = execSync(`py "${scriptPath}" --root "${dataRoot}"`, {
      timeout: 300000,
      encoding: "utf8",
      cwd: process.cwd(),
    });

    return NextResponse.json({ success: true, message: "Scan complete. " + result.trim() });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: "Scan failed: " + (err.stderr ?? err.message ?? "Unknown error"),
    }, { status: 500 });
  }
}
