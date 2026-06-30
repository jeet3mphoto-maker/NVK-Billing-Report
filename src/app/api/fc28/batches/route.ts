import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/fc28/batches — list all FC28 upload batches newest-first
export async function GET() {
  try {
    const batches = await db.fC28Batch.findMany({
      orderBy: { reportDate: "desc" },
      take: 50,
    });
    return NextResponse.json({ batches });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
