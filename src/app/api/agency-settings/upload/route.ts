import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function str(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "N/A" ? null : s;
}

// POST /api/agency-settings/upload
// Body: { files: [{ name, agencyRows[] }] }
// Replaces all existing AgencySetting data.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { files: { name: string; agencyRows: Record<string, any>[] }[] };
    const { files } = body;
    if (!files?.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    // Clear existing
    await db.agencySettingBatch.deleteMany({});

    const batch = await db.agencySettingBatch.create({
      data: { fileCount: files.length, rowCount: 0 },
    });

    const dbRows: any[] = [];

    for (const file of files) {
      if (!file.agencyRows?.length) continue;
      for (const row of file.agencyRows) {
        const lc: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) lc[k.trim().toLowerCase()] = v;

        dbRows.push({
          batchId:            batch.id,
          center:             str(lc["center"]),
          active:             str(lc["active"]),
          contractPeriod:     str(lc["contract period"]),
          name:               str(lc["name"]),
          type:               str(lc["type"]),
          useBlackoutDates:   str(lc["use blackout dates"]),
          discountsPermitted: str(lc["discounts permitted"]),
        });
      }
    }

    if (dbRows.length) {
      await db.agencySetting.createMany({ data: dbRows });
    }

    await db.agencySettingBatch.update({
      where: { id: batch.id },
      data:  { rowCount: dbRows.length },
    });

    return NextResponse.json({ batchId: batch.id, rowCount: dbRows.length, fileCount: files.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}
