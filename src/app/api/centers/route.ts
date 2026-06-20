import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const centers = await prisma.center.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { state: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { children: true, enrollments: true } } },
  });

  return NextResponse.json({ centers });
}
