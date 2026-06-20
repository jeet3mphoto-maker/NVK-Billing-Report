import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

/** Parse currency/number text like "$1,181.25" → number. */
function money(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const n = parseFloat(String(val).replace(/[(),$\s%]/g, ""));
  return isNaN(n) ? 0 : n;
}

const norm = (s: any) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Lookup key: center | version | program | classroom (times appended when present). */
export function rateKeyOf(centerName: string, version: string, program: string, classroom: string, dropOff = "", latePickup = "") {
  return [norm(centerName), norm(version), norm(program), norm(classroom), norm(dropOff), norm(latePickup)]
    .filter(Boolean)
    .join("|");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ success: false, message: "Missing file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    // Prefer a sheet named "Rate Card"; otherwise use the first sheet.
    const sheetName = wb.SheetNames.find((n) => /rate\s*card/i.test(n)) ?? wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null }) as Record<string, any>[];

    let processed = 0, rejected = 0;
    const errors: string[] = [];
    const centersInFile = new Set<string>();

    // Parse first so we can replace each center's card set atomically.
    const parsed: any[] = [];
    for (const rawRow of rows) {
      // Normalize header keys — the real Rate Card Master has stray trailing
      // spaces (e.g. "Classroom ") that would otherwise be missed.
      const row: Record<string, any> = {};
      for (const k in rawRow) row[String(k).trim()] = rawRow[k];

      const centerName = String(row["Center"] ?? row["Center Name"] ?? "").trim();
      const monthlyFees = money(row["Monthly Fees"] ?? row["Monthly fees"]);
      if (!centerName || !monthlyFees) { rejected++; continue; }

      const entity = String(row["Entity"] ?? "").trim() || null;
      const state = String(row["State"] ?? "").trim() || null;
      const version = String(row["Rate Card Version"] ?? row["Version"] ?? row["Source"] ?? "").trim();
      const program = String(row["Program"] ?? "").trim();
      const classroom = String(row["Classroom"] ?? row["Clean Classroom"] ?? "").trim();
      const dropOff = String(row["Drop Off"] ?? "").trim();
      const latePickup = String(row["Late Pickup"] ?? row["Drop Out"] ?? row["Pickup"] ?? "").trim();

      centersInFile.add(centerName);
      parsed.push({
        entity, state, centerName, version, program, classroom, dropOff, latePickup,
        monthlyFees,
        earlyAMRate: money(row["Early AM Care Rate"] ?? row["Early AM Care"]),
        latePMRate: money(row["Late PM Care Rate"] ?? row["Late PM Care"]),
        rateKey: rateKeyOf(centerName, version, program, classroom, dropOff, latePickup),
      });
    }

    // Replace existing cards for the centers present in this upload (idempotent re-upload).
    if (centersInFile.size) {
      await prisma.rateCard.deleteMany({ where: { centerName: { in: [...centersInFile] } } });
    }

    for (const r of parsed) {
      try {
        await prisma.rateCard.create({ data: r });
        // Keep the Center's Entity/State in sync when provided.
        if (r.entity || r.state) {
          const center = await prisma.center.findFirst({ where: { name: r.centerName } });
          if (center && ((r.entity && !center.entity) || (r.state && !center.state))) {
            await prisma.center.update({
              where: { id: center.id },
              data: { entity: center.entity ?? r.entity, state: center.state ?? r.state },
            });
          }
        }
        processed++;
      } catch (e: any) {
        rejected++;
        errors.push(e.message);
      }
    }

    return NextResponse.json({
      success: true,
      records: processed,
      errors: rejected,
      centers: centersInFile.size,
      errorLog: errors.slice(0, 50),
      message: `Imported ${processed} rate-card rows across ${centersInFile.size} center(s).`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message ?? "Internal error" }, { status: 500 });
  }
}
