import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET  /api/admin/asa-employees          → list all employees
// POST /api/admin/asa-employees          → { name } add employee
// DELETE /api/admin/asa-employees?id=N   → remove employee
// POST /api/admin/asa-employees?reapply=1 → re-evaluate entryBy for all existing Fin14Rows

export async function GET() {
  try {
    const employees = await db.asaEmployee.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ employees });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;

    // Re-apply mode: re-evaluate entryBy for all existing rows
    if (sp.get("reapply") === "1") {
      const emps: { name: string }[] = await db.asaEmployee.findMany({
        where: { isActive: true },
        select: { name: true },
      });
      const asaNames = new Set(emps.map((e: { name: string }) => e.name.trim().toLowerCase()));

      // Fetch all rows that are NOT system-matched (entryBy !== "System")
      const rows: { id: number; rawData: any }[] = await db.fin14Row.findMany({
        where: { isMatched: false },
        select: { id: true, rawData: true },
      });

      let asaCount = 0;
      let centerCount = 0;

      // Batch update in groups of 500
      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        await Promise.all(
          slice.map((row) => {
            const createdBy = String(row.rawData?.["Created By"] ?? "").trim();
            if (!createdBy) return Promise.resolve();
            const entryBy = asaNames.has(createdBy.toLowerCase()) ? "ASA" : "Center";
            if (entryBy === "ASA") asaCount++; else centerCount++;
            return db.fin14Row.update({ where: { id: row.id }, data: { entryBy } });
          })
        );
      }

      return NextResponse.json({ reapplied: rows.length, asaCount, centerCount });
    }

    // Add employee
    const { name } = await req.json() as { name: string };
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const employee = await db.asaEmployee.upsert({
      where: { name: name.trim() },
      create: { name: name.trim() },
      update: { isActive: true },
    });
    return NextResponse.json({ employee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.asaEmployee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
