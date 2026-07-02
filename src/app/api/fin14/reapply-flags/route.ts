import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const db = prisma as any;

function matchItem(
  txnItem: string,
  masters: { item: string; majorHead: string; subHead: string }[]
) {
  if (!txnItem) return null;
  const lower  = txnItem.toLowerCase();
  const sorted = [...masters].sort((a, b) => b.item.length - a.item.length);
  return sorted.find((m) => lower.includes(m.item.toLowerCase())) ?? null;
}

// POST /api/fin14/reapply-flags
// Re-runs ItemMaster matching against all FIN14 rows in the latest batch.
// Rows with a match → majorHead/subHead/isMatched updated.
// Rows already manually flagged (entryBy = "Manual") are left untouched.
export async function POST() {
  try {
    // Load ItemMaster rules
    const masters: { item: string; majorHead: string; subHead: string }[] =
      await db.itemMaster.findMany({ where: { isActive: true } });

    if (!masters.length) {
      return NextResponse.json({ error: "ItemMaster is empty. Add rules first." }, { status: 400 });
    }

    // Load ASA employees
    const emps: { name: string }[] = await db.asaEmployee.findMany({ where: { isActive: true }, select: { name: true } }).catch(() => []);
    const asaNames = new Set(emps.map((e: { name: string }) => e.name.trim().toLowerCase()));

    // Get latest batch
    const batch = await db.fin14Batch.findFirst({ orderBy: { createdAt: "desc" } });
    if (!batch) return NextResponse.json({ error: "No FIN14 data found." }, { status: 404 });

    // Load all rows (only id, itemText, entryBy)
    const rows: { id: number; itemText: string | null; entryBy: string | null; rawData: any }[] =
      await prisma.$queryRawUnsafe(
        `SELECT id, "itemText", "entryBy", "rawData" FROM "Fin14Row" WHERE "batchId" = $1`,
        batch.id
      );

    const BATCH = 2000;
    let matched = 0, unmatched = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const valueParts: string[] = [];
      const params: any[]        = [];
      let pi = 1;

      for (const row of chunk) {
        // (all rows re-flagged, including Manual)

        const itemText = row.itemText ?? String((row.rawData as any)?.["Item"] ?? (row.rawData as any)?.["item"] ?? "").trim();
        const hit = matchItem(itemText, masters);

        // Determine entryBy
        let entryBy: string;
        if (hit) {
          entryBy = "System";
        } else {
          const createdBy = String((row.rawData as any)?.["Created By"] ?? (row.rawData as any)?.["created by"] ?? "").trim().toLowerCase();
          entryBy = asaNames.has(createdBy) ? "ASA" : "Center";
        }

        valueParts.push(`($${pi}::int, $${pi+1}::text, $${pi+2}::text, $${pi+3}::boolean, $${pi+4}::text)`);
        params.push(
          row.id,
          hit?.majorHead ?? null,
          hit?.subHead   ?? null,
          !!hit,
          entryBy,
        );
        pi += 5;
        if (hit) matched++; else unmatched++;
      }

      if (valueParts.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Fin14Row" AS t
           SET "majorHead" = v.major_head,
               "subHead"   = v.sub_head,
               "isMatched" = v.is_matched,
               "entryBy"   = v.entry_by,
               "itemText"  = COALESCE(t."itemText", t."rawData"->>'Item')
           FROM (VALUES ${valueParts.join(",")}) AS v(id, major_head, sub_head, is_matched, entry_by)
           WHERE t.id = v.id`,
          ...params
        );
      }
    }

    // Update batch counts
    const [rowCount, matchedCount] = await Promise.all([
      db.fin14Row.count({ where: { batchId: batch.id } }),
      db.fin14Row.count({ where: { batchId: batch.id, isMatched: true } }),
    ]);
    await db.fin14Batch.update({
      where: { id: batch.id },
      data:  { rowCount, matchedCount, unmatchedCount: rowCount - matchedCount },
    });

    return NextResponse.json({
      total: rows.length,
      matched,
      unmatched,
      message: `Re-flagged ${rows.length} rows — ${matched} matched, ${unmatched} unmatched`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Reapply failed" }, { status: 500 });
  }
}
