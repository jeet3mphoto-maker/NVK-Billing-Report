import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Save a remark / detailed remark / category on a billing-fact (variance) record. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, remark, detailedRemark, category, commentBy } = body ?? {};
    if (!id) return NextResponse.json({ success: false, message: "Missing record id" }, { status: 400 });

    const data: any = { commentAt: new Date() };
    if (remark !== undefined) data.remark = remark || null;
    if (detailedRemark !== undefined) data.detailedRemark = detailedRemark || null;
    if (category !== undefined) data.varianceCategory = category;
    if (commentBy !== undefined) data.commentBy = commentBy || null;

    const updated = await prisma.billingFact.update({ where: { id }, data });
    return NextResponse.json({ success: true, id: updated.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
