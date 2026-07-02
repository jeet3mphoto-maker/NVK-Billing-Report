import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/agency-name-mapping — list all mappings
export async function GET() {
  const mappings = await db.agencyNameMapping.findMany({ orderBy: { fc28AgencyName: "asc" } });
  return NextResponse.json({ mappings });
}
