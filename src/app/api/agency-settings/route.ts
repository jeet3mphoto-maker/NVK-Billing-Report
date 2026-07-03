import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/agency-settings
// ?all=1  → return all rows (for the Agency Settings view page)
// default → return distinct names only (for the Agency Mapping dropdown)
export async function GET(req: NextRequest) {
  try {
    const all = new URL(req.url).searchParams.get("all") === "1";

    const batch = await db.agencySettingBatch.findFirst({ orderBy: { uploadedAt: "desc" } });
    if (!batch) return NextResponse.json({ names: [], rows: [], batch: null });

    const rows = await db.agencySetting.findMany({
      where:   { batchId: batch.id },
      orderBy: [{ name: "asc" }, { center: "asc" }],
    });

    const names: string[] = Array.from(
      new Set(rows.map((r: any) => r.name).filter(Boolean))
    ).sort() as string[];

    return NextResponse.json({ names, rows: all ? rows : [], batch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
