import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const db = prisma as any;

function to24h(t: string | null): string {
  if (!t) return "";
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return t.trim();
  let h = parseInt(m[1], 10);
  const min = m[2], sec = m[3] ?? "00", ampm = m[4].toUpperCase();
  if (ampm === "AM") { if (h === 12) h = 0; }
  else               { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, "0")}:${min}:${sec}`;
}

// POST /api/fc28/recompute-keys
// Re-applies current ClassroomMapping to all rows in the latest FC28 batch,
// updating rateCardKey, revisedClassroom, earlyAMRateCardKey, latePMRateCardKey.
// Call this after saving new classroom mappings without re-uploading FC28.
export async function POST() {
  try {
    // 1. Load classroom mappings
    const classroomMappingRows: { fc28Classroom: string; rateSheetItem: string | null }[] =
      await db.classroomMapping.findMany();
    const classroomMap = new Map<string, string>();
    for (const c of classroomMappingRows) {
      if (c.rateSheetItem) classroomMap.set(c.fc28Classroom, c.rateSheetItem);
    }

    // 2. Latest FC28 batch
    const latestBatch = await db.fC28Batch.findFirst({ orderBy: { reportDate: "desc" } });
    if (!latestBatch) return NextResponse.json({ error: "No FC28 batch found" }, { status: 404 });

    // 3. Load all rows (only needed fields)
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, center, "rateSheet", "dropOff", pickup, program, classroom FROM "FC28Row" WHERE "batchId" = $1`,
      latestBatch.id
    );

    let updated = 0, unmapped = 0;
    const BATCH = 500;

    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const updates: string[] = [];
      const params: any[] = [];
      let pi = 1;

      for (const row of chunk) {
        const centerShort        = (row.center ?? "").split(",")[0].trim();
        const classroom          = row.classroom ?? "";
        const revisedClassroom   = classroom ? (classroomMap.get(classroom) ?? null) : null;
        const effectiveClassroom = revisedClassroom ?? classroom;
        const dropOff24          = to24h(row.dropOff);
        const pickup24           = to24h(row.pickup);
        const rateSheet          = row.rateSheet ?? "";
        const program            = row.program ?? "";

        const rateCardKey        = [centerShort, rateSheet, dropOff24, pickup24, program,           effectiveClassroom].join("|");
        const earlyAMRateCardKey = [centerShort, rateSheet, dropOff24, pickup24, "Early AM Care",   effectiveClassroom].join("|");
        const latePMRateCardKey  = [centerShort, rateSheet, dropOff24, pickup24, "Late PM Care",    effectiveClassroom].join("|");

        if (!revisedClassroom) unmapped++;

        updates.push(`($${pi}::int, $${pi+1}, $${pi+2}, $${pi+3}, $${pi+4}, $${pi+5})`);
        params.push(row.id, rateCardKey, revisedClassroom, earlyAMRateCardKey, latePMRateCardKey, effectiveClassroom);
        pi += 6;
        updated++;
      }

      if (updates.length) {
        await prisma.$executeRawUnsafe(
          `UPDATE "FC28Row" AS t
           SET "rateCardKey"        = v.rck,
               "revisedClassroom"   = v.rc,
               "earlyAMRateCardKey" = v.eam,
               "latePMRateCardKey"  = v.lpm
           FROM (VALUES ${updates.join(",")}) AS v(id, rck, rc, eam, lpm, eff)
           WHERE t.id = v.id::int`,
          ...params
        );
      }
    }

    return NextResponse.json({
      updated,
      unmapped,
      mapped: updated - unmapped,
      message: `${updated} rows recomputed — ${updated - unmapped} classrooms mapped, ${unmapped} still unmapped`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Recompute failed" }, { status: 500 });
  }
}
