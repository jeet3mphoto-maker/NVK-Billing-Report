import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/classroom-mapping — list all classroom mappings
export async function GET() {
  const rows = await db.classroomMapping.findMany({ orderBy: { fc28Classroom: "asc" } });
  return NextResponse.json({ mappings: rows });
}
