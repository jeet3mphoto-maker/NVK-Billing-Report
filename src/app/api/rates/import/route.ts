import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const norm = (s: any) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const normClass = (s: any) => norm(s).replace(/\s+[a-z0-9]$/, "").trim();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "Missing file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];

    let processed = 0;
    let rejected = 0;
    const errors: string[] = [];

    // Optionally: clear all existing RateCards or only those matching the upload.
    // For a master upload, we generally wipe and replace.
    await prisma.rateCard.deleteMany({});

    for (const row of rows) {
      try {
        const centerName = String(row["Center"] ?? "").trim();
        if (!centerName) {
          rejected++;
          continue;
        }

        const entity = String(row["Entity"] ?? "").trim() || null;
        const state = String(row["State"] ?? "").trim() || null;
        const version = String(row["Rate Card Version"] ?? row["Version"] ?? "").trim() || null;
        const program = String(row["Program"] ?? "").trim() || null;
        const classroom = String(row["Classroom"] ?? "").trim() || null;
        const dropOff = String(row["Drop Off"] ?? "").trim() || null;
        const latePickup = String(row["Late Pickup"] ?? "").trim() || null;

        const monthlyFees = parseFloat(row["Monthly Fees"] ?? row["Rate"] ?? 0) || 0;
        const earlyAMRate = parseFloat(row["Early AM Care Rate"] ?? row["Early AM"] ?? 0) || 0;
        const latePMRate = parseFloat(row["Late PM Care Rate"] ?? row["Late PM"] ?? 0) || 0;

        const rateKey = [norm(centerName), norm(version), norm(program), normClass(classroom)].filter(Boolean).join("|");

        await prisma.rateCard.create({
          data: {
            entity,
            state,
            centerName,
            version,
            program,
            classroom,
            dropOff,
            latePickup,
            monthlyFees,
            earlyAMRate,
            latePMRate,
            rateKey,
            isActive: true
          }
        });

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
      errorLog: errors.slice(0, 100),
      message: "Rate Cards imported successfully" 
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message ?? "Internal error" }, { status: 500 });
  }
}
