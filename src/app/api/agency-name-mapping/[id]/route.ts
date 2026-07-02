import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// PATCH /api/agency-name-mapping/[id] — update agencySettingName for one mapping
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { agencySettingName } = await req.json();
    const updated = await db.agencyNameMapping.update({
      where: { id },
      data:  { agencySettingName: agencySettingName || null },
    });
    return NextResponse.json({ mapping: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Update failed" }, { status: 500 });
  }
}

// DELETE /api/agency-name-mapping/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.agencyNameMapping.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Delete failed" }, { status: 500 });
  }
}
