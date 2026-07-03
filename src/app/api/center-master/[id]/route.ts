import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// PATCH /api/center-master/[id] — update coreWeeks
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { coreWeeks } = await req.json();
    const updated = await db.centerMaster.update({
      where: { id: params.id },
      data: { coreWeeks: coreWeeks === "" || coreWeeks === null ? null : parseFloat(coreWeeks) },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
