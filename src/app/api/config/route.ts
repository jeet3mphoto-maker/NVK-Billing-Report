import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { readConfig, writeConfig } from "@/lib/app-config";

export async function GET() {
  return NextResponse.json(readConfig());
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = writeConfig(body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Validate that a folder path exists and contains FC28 files
export async function POST(req: NextRequest) {
  try {
    const { fc28HistoryPath } = await req.json();
    if (!fc28HistoryPath) return NextResponse.json({ valid: false, error: "Path is required" }, { status: 400 });

    if (!fs.existsSync(fc28HistoryPath)) {
      return NextResponse.json({ valid: false, error: "Folder not found" });
    }
    const files = fs.readdirSync(fc28HistoryPath).filter((f) =>
      f.toLowerCase().endsWith(".xlsx") || f.toLowerCase().endsWith(".xls")
    );
    return NextResponse.json({ valid: true, fileCount: files.length, files: files.slice(0, 5) });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
  }
}
