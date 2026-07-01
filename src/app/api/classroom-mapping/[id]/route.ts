import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// PATCH /api/classroom-mapping/[id] — update rateSheetItem for one mapping
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { rateSheetItem } = await req.json();
    const updated = await db.classroomMapping.update({
      where: { id },
      data:  { rateSheetItem: rateSheetItem || null },
    });
    return NextResponse.json({ mapping: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Update failed" }, { status: 500 });
  }
}

// DELETE /api/classroom-mapping/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.classroomMapping.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Delete failed" }, { status: 500 });
  }
}
