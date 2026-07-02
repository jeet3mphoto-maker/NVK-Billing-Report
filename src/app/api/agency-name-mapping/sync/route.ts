import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// POST /api/agency-name-mapping/sync
// Pulls all unique agency1 + agency2 values from the latest FC28 batch and
// inserts any that don't exist yet in AgencyNameMapping (leaves existing mappings intact).
export async function POST() {
  try {
    const latestBatch = await db.fC28Batch.findFirst({ orderBy: { reportDate: "desc" } });
    if (!latestBatch) return NextResponse.json({ error: "No FC28 batch found" }, { status: 404 });

    const [agency1Rows, agency2Rows] = await Promise.all([
      db.fC28Row.findMany({
        where:    { batchId: latestBatch.id, agency1: { not: null } },
        select:   { agency1: true },
        distinct: ["agency1"],
      }),
      db.fC28Row.findMany({
        where:    { batchId: latestBatch.id, agency2: { not: null } },
        select:   { agency2: true },
        distinct: ["agency2"],
      }),
    ]);

    const names = Array.from(new Set([
      ...agency1Rows.map((r: any) => r.agency1).filter(Boolean),
      ...agency2Rows.map((r: any) => r.agency2).filter(Boolean),
    ])) as string[];

    let added = 0;
    for (const fc28AgencyName of names) {
      const existing = await db.agencyNameMapping.findUnique({ where: { fc28AgencyName } });
      if (!existing) {
        await db.agencyNameMapping.create({ data: { fc28AgencyName } });
        added++;
      }
    }

    return NextResponse.json({ total: names.length, added, skipped: names.length - added });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}
