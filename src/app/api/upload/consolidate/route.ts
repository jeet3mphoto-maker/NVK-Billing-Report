import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

function matchItem(txnItem: string, masters: { id: number; item: string; majorHead: string; subHead: string }[]) {
  if (!txnItem) return null;
  const lower  = txnItem.toLowerCase();
  const sorted = [...masters].sort((a, b) => b.item.length - a.item.length);
  return sorted.find((m) => lower.includes(m.item.toLowerCase())) ?? null;
}

// POST /api/upload/consolidate
// Body: { rows, fileCount, batchId?, isFinal }
// - First chunk  (no batchId):            creates batch, inserts rows, returns { batchId }
// - Middle chunks (batchId, isFinal=false): appends rows, returns { batchId }
// - Last chunk   (batchId, isFinal=true):  appends rows, updates stats, returns JSON counts
//   NOTE: Excel generation moved to the client — it already holds all rows in memory.
export async function POST(req: NextRequest) {
  try {
    const body             = await req.json();
    const incomingRows: Record<string, any>[] = body.rows ?? [];
    const fileCount: number                    = body.fileCount ?? 0;
    const existingBatchId: string | undefined  = body.batchId;
    const isFinal: boolean                     = body.isFinal ?? true;

    if (!incomingRows.length) {
      return NextResponse.json({ success: false, message: "No data rows provided" }, { status: 400 });
    }

    // Load item master + ASA employee list once per request
    let masters: { id: number; item: string; majorHead: string; subHead: string }[] = [];
    let asaNames: Set<string> = new Set();
    try {
      masters = await (prisma as any).itemMaster.findMany({ where: { isActive: true } });
    } catch { /* table may not exist yet */ }
    try {
      const emps: { name: string }[] = await (prisma as any).asaEmployee.findMany({ where: { isActive: true }, select: { name: true } });
      asaNames = new Set(emps.map((e) => e.name.trim().toLowerCase()));
    } catch { /* table may not exist yet */ }

    const headerKeys  = Object.keys(incomingRows[0] ?? {});
    const itemCol     = headerKeys.find((k) => k.trim().toLowerCase() === "item") ?? null;
    const createdByCol = headerKeys.find((k) => k.trim().toLowerCase() === "created by") ?? null;

    const dbRows = incomingRows.map((row) => {
      const txnItem   = itemCol      ? String(row[itemCol]      ?? "").trim() : "";
      const createdBy = createdByCol ? String(row[createdByCol] ?? "").trim() : "";
      const match     = txnItem ? matchItem(txnItem, masters) : null;
      // entryBy: if item matched → "System"; else check Created By against ASA employee master
      let entryBy: string | null = null;
      if (match) {
        entryBy = "System";
      } else if (createdBy) {
        entryBy = asaNames.has(createdBy.toLowerCase()) ? "ASA" : "Center";
      }
      return {
        rawData:   row,
        itemText:  txnItem || null,
        majorHead: match?.majorHead ?? null,
        subHead:   match?.subHead   ?? null,
        entryBy,
        isMatched: !!match,
      };
    });

    let batchId: string;

    if (!existingBatchId) {
      // First chunk — create batch with nested rows
      const batch = await (prisma as any).fin14Batch.create({
        data: {
          fileCount,
          rowCount:       0,
          matchedCount:   0,
          unmatchedCount: 0,
          rows: { create: dbRows },
        },
      });
      batchId = batch.id;
    } else {
      // Subsequent chunk — append rows
      batchId = existingBatchId;
      await (prisma as any).fin14Row.createMany({
        data: dbRows.map((r) => ({ ...r, batchId })),
      });
    }

    // Return early if more chunks are coming
    if (!isFinal) {
      return NextResponse.json({ batchId });
    }

    // Final chunk — tally stats from DB (no need to fetch all rows back)
    const [rowCount, matchedCount] = await Promise.all([
      (prisma as any).fin14Row.count({ where: { batchId } }),
      (prisma as any).fin14Row.count({ where: { batchId, isMatched: true } }),
    ]);
    const unmatchedCount = rowCount - matchedCount;

    await (prisma as any).fin14Batch.update({
      where: { id: batchId },
      data:  { rowCount, matchedCount, unmatchedCount },
    });

    // Return counts only — client generates the Excel locally from the rows it already parsed
    return NextResponse.json({
      batchId,
      rowCount,
      matchedCount,
      unmatchedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message ?? "Internal error" }, { status: 500 });
  }
}
