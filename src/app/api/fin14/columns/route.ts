import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM_COLS = ["Status", "Major Head", "Sub Head", "Entry By"];

export async function GET() {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "rawData" FROM "Fin14Row" LIMIT 500`
    );

    const allKeys = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row.rawData ?? {})) allKeys.add(k);
    }

    const fc28Keys  = Array.from(allKeys).filter(k => k.endsWith("(FC28)"));
    const fin14Keys = Array.from(allKeys).filter(k => !k.endsWith("(FC28)")).sort();

    return NextResponse.json({
      groups: [
        { label: "System Fields", cols: SYSTEM_COLS },
        { label: "FIN14 Data",    cols: fin14Keys  },
        { label: "FC28 Fields",   cols: fc28Keys   },
      ].filter(g => g.cols.length > 0),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
