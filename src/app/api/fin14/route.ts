import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function buildWhere(sp: URLSearchParams | Record<string, string | undefined>) {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : sp[k]) ?? undefined;
  const where: any = {};
  const batchId    = get("batchId");
  const isMatched  = get("isMatched");
  const majorHead  = get("majorHead");
  const subHead    = get("subHead");
  const itemSearch = get("itemSearch");
  if (batchId)               where.batchId   = batchId;
  if (isMatched === "true")  where.isMatched = true;
  if (isMatched === "false") where.isMatched = false;
  if (majorHead)             where.majorHead = majorHead;
  if (subHead)               where.subHead   = subHead;
  if (itemSearch)            where.itemText  = { contains: itemSearch, mode: "insensitive" };
  return where;
}

// GET /api/fin14
export async function GET(req: NextRequest) {
  const sp       = new URL(req.url).searchParams;
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 100)));
  const where    = buildWhere(sp);

  const [total, rows] = await Promise.all([
    db.fin14Row.count({ where }),
    db.fin14Row.findMany({ where, orderBy: { id: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return NextResponse.json({ total, page, pageSize, rows });
}

// PATCH /api/fin14
// Mode A — by IDs:      { ids, majorHead, subHead, entryBy }
// Mode B — by filters:  { flagAll: true, filters: { batchId?, isMatched?, majorHead?, subHead?, itemSearch? }, majorHead, subHead, entryBy }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { majorHead, subHead, entryBy } = body;
  if (!majorHead || !subHead) return NextResponse.json({ error: "majorHead and subHead required" }, { status: 400 });

  const updateData = {
    majorHead,
    subHead,
    entryBy:   entryBy ?? "Manual",
    isMatched: true,
    flaggedBy: entryBy ?? "Manual",
    flaggedAt: new Date(),
  };

  if (body.flagAll) {
    // Update ALL rows matching the supplied filter object
    const where = buildWhere(body.filters ?? {});
    const result = await db.fin14Row.updateMany({ where, data: updateData });
    return NextResponse.json({ updated: result.count });
  }

  // Default: update by explicit ids
  const { ids } = body;
  if (!ids?.length) return NextResponse.json({ error: "ids array or flagAll required" }, { status: 400 });
  await db.fin14Row.updateMany({ where: { id: { in: ids.map(Number) } }, data: updateData });
  return NextResponse.json({ updated: ids.length });
}
