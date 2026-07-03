import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const db = prisma as any;

// POST /api/child-billing/aggregate
// Groups FIN14 transactions (isMatched=true) by Child ID.
// Each (Major Head + Sub Head) combination becomes a column in rawData with summed Amount.
export async function POST() {
  try {
    // 1. Load all matched FIN14 rows — only fields we need
    const fin14Rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "rawData", "majorHead", "subHead"
       FROM "Fin14Row"
       WHERE "isMatched" = true
         AND "majorHead" IS NOT NULL
         AND "subHead"   IS NOT NULL`
    );

    if (!fin14Rows.length) {
      return NextResponse.json({ error: "No matched/flagged FIN14 transactions found. Flag transactions first." }, { status: 400 });
    }

    // 2. Group by Child ID, accumulate amounts per head combo
    type ChildKey = string; // childId
    const childMap = new Map<ChildKey, {
      childId:    string;
      childName:  string;
      center:     string;
      centerId:   string;
      familyId:   string;
      familyName: string;
      amounts:    Map<string, number>;
    }>();

    for (const row of fin14Rows) {
      const rd        = (row.rawData ?? {}) as Record<string, any>;
      const childId   = String(rd["Child ID"]    ?? rd["child_id"]    ?? "").trim();
      const childName = String(rd["Child Name"]  ?? rd["child_name"]  ?? "").trim();
      const center    = String(rd["Center"]      ?? "").trim();
      const centerId  = String(rd["Center ID"]   ?? "").trim();
      const familyId  = String(rd["Family ID"]   ?? "").trim();
      const familyName= String(rd["Family Name"] ?? "").trim();

      const amountRaw = rd["Amount"] ?? rd["amount"] ?? "0";
      const amount    = parseFloat(String(amountRaw).replace(/[^0-9.-]/g, "")) || 0;
      const headCol   = `${row.majorHead} - ${row.subHead}`;

      const key = childId || `${childName}__${centerId}`;
      if (!childMap.has(key)) {
        childMap.set(key, { childId, childName, center, centerId, familyId, familyName, amounts: new Map() });
      }
      const entry = childMap.get(key)!;
      entry.amounts.set(headCol, (entry.amounts.get(headCol) ?? 0) + amount);
    }

    // 3. Delete existing child billing data and create new batch
    await db.childBillingBatch.deleteMany({});
    const batch = await db.childBillingBatch.create({ data: { rowCount: 0 } });

    // 4. Build and insert rows (batch of 500)
    const INSERT_BATCH = 500;
    const entries = Array.from(childMap.values());
    let inserted = 0;

    for (let i = 0; i < entries.length; i += INSERT_BATCH) {
      const chunk = entries.slice(i, i + INSERT_BATCH);
      const dbRows = chunk.map((e) => {
        const rawData: Record<string, any> = {};
        for (const [col, val] of e.amounts) {
          rawData[col] = Math.round(val * 100) / 100;
        }
        return {
          batchId:    batch.id,
          childId:    e.childId    || null,
          childName:  e.childName  || null,
          center:     e.center     || null,
          centerId:   e.centerId   || null,
          familyId:   e.familyId   || null,
          familyName: e.familyName || null,
          rawData,
        };
      });
      await db.childBillingRow.createMany({ data: dbRows });
      inserted += dbRows.length;
    }

    // 5. Update batch row count
    await db.childBillingBatch.update({ where: { id: batch.id }, data: { rowCount: inserted } });

    return NextResponse.json({
      batchId:  batch.id,
      children: inserted,
      message:  `Aggregated ${fin14Rows.length.toLocaleString()} transactions into ${inserted.toLocaleString()} child-level rows`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Aggregation failed" }, { status: 500 });
  }
}
