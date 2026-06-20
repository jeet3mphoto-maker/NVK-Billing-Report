import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [fin14Count, fin02Count] = await Promise.all([
    prisma.fileUpload.count({
      where: { fileType: { in: ["FIN14_AR", "FIN14"] }, status: "COMPLETED" },
    }),
    prisma.fileUpload.count({
      where: { fileType: "FIN02", status: "COMPLETED" },
    }),
  ]);

  return NextResponse.json({
    step1Done: fin14Count > 0,
    step2Done: fin02Count > 0,
    fin14Files: fin14Count,
    fin02Files: fin02Count,
  });
}
