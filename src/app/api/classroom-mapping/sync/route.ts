import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// POST /api/classroom-mapping/sync
// Pulls all unique classroom values from the latest FC28 batch and inserts
// any that don't exist yet in ClassroomMapping (leaves existing mappings intact).
export async function POST() {
  try {
    const latestBatch = await db.fC28Batch.findFirst({ orderBy: { reportDate: "desc" } });
    if (!latestBatch) return NextResponse.json({ error: "No FC28 batch found" }, { status: 404 });

    const rows: { classroom: string }[] = await db.fC28Row.findMany({
      where:    { batchId: latestBatch.id, classroom: { not: null } },
      select:   { classroom: true },
      distinct: ["classroom"],
    });

    const classrooms = rows.map((r) => r.classroom).filter(Boolean) as string[];

    // Upsert: create if not exists, skip if already mapped
    let added = 0;
    for (const fc28Classroom of classrooms) {
      const existing = await db.classroomMapping.findUnique({ where: { fc28Classroom } });
      if (!existing) {
        await db.classroomMapping.create({ data: { fc28Classroom } });
        added++;
      }
    }

    return NextResponse.json({ total: classrooms.length, added, skipped: classrooms.length - added });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}
