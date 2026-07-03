import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/center-master — list all centers
export async function GET() {
  try {
    const rows = await db.centerMaster.findMany({ orderBy: { centerName: "asc" } });
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/center-master/sync — sync unique center names from latest FC28 batch
export async function POST() {
  try {
    const latestFC28 = await db.fC28Batch.findFirst({ orderBy: { reportDate: "desc" } });
    if (!latestFC28) return NextResponse.json({ error: "No FC28 batch found" }, { status: 404 });

    const centers: { center: string }[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "center" FROM "FC28Row" WHERE "batchId" = $1 AND "center" IS NOT NULL AND "center" != ''`,
      latestFC28.id
    );

    let added = 0, skipped = 0;
    for (const { center } of centers) {
      const centerShort = center.split(",")[0].trim();
      await db.centerMaster.upsert({
        where: { centerName: center },
        update: { centerShort },
        create: { centerName: center, centerShort },
      });
      added++;
    }

    return NextResponse.json({ added, skipped, total: centers.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
