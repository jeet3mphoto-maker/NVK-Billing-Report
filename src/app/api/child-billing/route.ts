import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/child-billing — paginated child-level rows from latest batch
export async function GET(req: NextRequest) {
  const sp       = new URL(req.url).searchParams;
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 100)));
  const search   = sp.get("search") ?? "";

  const batch = await db.childBillingBatch.findFirst({ orderBy: { createdAt: "desc" } });
  if (!batch) return NextResponse.json({ total: 0, page, pageSize, rows: [], batchId: null });

  const where: any = { batchId: batch.id };
  if (search) {
    where.OR = [
      { childId:   { contains: search, mode: "insensitive" } },
      { childName: { contains: search, mode: "insensitive" } },
      { center:    { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, rows, allKeysRows] = await Promise.all([
    db.childBillingRow.count({ where }),
    db.childBillingRow.findMany({
      where,
      orderBy: [{ center: "asc" }, { childName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // Collect all distinct rawData keys across the entire batch
    prisma.$queryRawUnsafe(
      `SELECT DISTINCT jsonb_object_keys("rawData") AS key FROM "ChildBillingRow" WHERE "batchId" = $1`,
      batch.id
    ) as Promise<{ key: string }[]>,
  ]);

  const allColumns = (allKeysRows as { key: string }[]).map((r) => r.key);

  return NextResponse.json({ total, page, pageSize, rows, batchId: batch.id, allColumns });
}

// DELETE /api/child-billing — clears all child billing data
export async function DELETE() {
  const result = await db.childBillingBatch.deleteMany({});
  return NextResponse.json({ deleted: result.count });
}
