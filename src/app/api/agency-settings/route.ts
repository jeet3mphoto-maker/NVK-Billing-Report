import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/agency-settings — return distinct agency names + current batch info
export async function GET() {
  try {
    const batch = await db.agencySettingBatch.findFirst({ orderBy: { uploadedAt: "desc" } });
    if (!batch) return NextResponse.json({ names: [], rows: [], batch: null });

    const rows = await db.agencySetting.findMany({
      where:   { batchId: batch.id },
      orderBy: [{ center: "asc" }, { name: "asc" }],
    });

    const names: string[] = Array.from(
      new Set(rows.map((r: any) => r.name).filter(Boolean))
    ).sort() as string[];

    return NextResponse.json({ names, rows, batch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
