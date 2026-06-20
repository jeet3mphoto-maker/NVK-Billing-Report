import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const centerId = searchParams.get("centerId");

  const where: any = {};
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { childId: { contains: q, mode: "insensitive" } },
      { family: { familyId: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (centerId) where.centerId = centerId;

  const children = await prisma.child.findMany({
    where,
    take: limit,
    orderBy: { fullName: "asc" },
    include: {
      center: { select: { name: true } },
      family: { select: { familyId: true } },
      _count: { select: { enrollments: true, transactions: true } },
    },
  });

  return NextResponse.json({ children, total: children.length });
}
