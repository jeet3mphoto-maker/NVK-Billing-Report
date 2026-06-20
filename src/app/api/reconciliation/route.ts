import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MATCH_TOLERANCE = 1;
const RECURRING_HEADS = new Set(["Regular", "Agency", "Early-Late", "Discount", "Other"]);

/**
 * Normalize a child name to "first last" lowercase for cross-system matching.
 * Handles both "Last, First" (FIN02) and "First Last" (FC28) formats.
 */
function normalizeChildName(name: string): string {
  if (!name) return "";
  const s = name.trim();
  if (s.includes(",")) {
    const [last, ...rest] = s.split(",");
    return `${rest.join(",").trim()} ${last.trim()}`.toLowerCase().replace(/\s+/g, " ").trim();
  }
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeToMonthly(amount: number, frequency: string | null, weeklyFactor: number): number {
  const f = (frequency ?? "").toLowerCase();
  if (f.startsWith("day")) return amount * 21;
  if (f.startsWith("week")) return amount * weeklyFactor;
  return amount; // Monthly or unknown → use as-is
}

// GET /api/reconciliation — list runs + available FIN02 uploads
export async function GET() {
  const [runs, fin02Uploads] = await Promise.all([
    prisma.fin02Reconciliation.findMany({ orderBy: { runAt: "desc" }, take: 50 }),
    prisma.fileUpload.findMany({
      where: { fileType: "FIN02" },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, fileName: true, uploadedAt: true, recordsProcessed: true, status: true },
    }),
  ]);
  return NextResponse.json({ runs, fin02Uploads });
}

// POST /api/reconciliation — run FIN02 × FIN14 × FC28 reconciliation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { billingPeriod, fin02UploadId: requestedFin02UploadId } = body;

    if (!billingPeriod) {
      return NextResponse.json({ error: "billingPeriod is required" }, { status: 400 });
    }

    // Resolve which FIN02 upload to use
    let fin02UploadId: string | null = requestedFin02UploadId ?? null;
    if (!fin02UploadId) {
      const latest = await prisma.fileUpload.findFirst({
        where: { fileType: "FIN02", status: "COMPLETED" },
        orderBy: { uploadedAt: "desc" },
      });
      fin02UploadId = latest?.id ?? null;
    }

    // ── Load FIN02 rate lines ─────────────────────────────────────────────────
    // FIN02 has multiple lines per child (tuition + agency + discounts).
    // Group by normalized child name so we can sum per child.
    const fin02Rates = fin02UploadId
      ? await prisma.fin02Rate.findMany({ where: { uploadId: fin02UploadId } })
      : [];

    const fin02ByName = new Map<string, typeof fin02Rates>();
    for (const r of fin02Rates) {
      const key = normalizeChildName(r.childName ?? "");
      if (!key) continue;
      const arr = fin02ByName.get(key) ?? [];
      arr.push(r);
      fin02ByName.set(key, arr);
    }

    // ── Load enrolled children (FC28 isLatest=true) ───────────────────────────
    const enrolledChildren = await prisma.child.findMany({
      where: { enrollments: { some: { isLatest: true } } },
      include: {
        enrollments: { where: { isLatest: true }, take: 1 },
        family: true,
        center: true,
      },
    });

    // ── Load FIN14 transactions for the billing period ────────────────────────
    const allTxns = await prisma.transaction.findMany({ where: { billingPeriod } });

    const txByChildId  = new Map<string, typeof allTxns>();
    const txByFamilyId = new Map<string, typeof allTxns>();
    for (const tx of allTxns) {
      if (tx.childId) {
        const arr = txByChildId.get(tx.childId) ?? [];
        arr.push(tx);
        txByChildId.set(tx.childId, arr);
      }
      const arr2 = txByFamilyId.get(tx.familyId) ?? [];
      arr2.push(tx);
      txByFamilyId.set(tx.familyId, arr2);
    }

    // ── Build reconciliation lines for enrolled children ──────────────────────
    const lines: any[] = [];
    const processedChildDbIds = new Set<string>();

    for (const child of enrolledChildren) {
      const enrollment = child.enrollments[0];
      if (!enrollment) continue;
      processedChildDbIds.add(child.id);

      // FIN02 lookup — name-based (FIN02 has no IDs)
      const fc28NameKey = normalizeChildName(child.fullName);
      const fin02Lines = fin02ByName.get(fc28NameKey) ?? [];
      const hasFin02 = fin02Lines.length > 0;

      // Sum FIN02 to get net expected (tuition + agency − discounts)
      const weeklyFactor = child.center.coreWeeklyFactor?.toNumber() ?? 4.33;
      const expectedAmount = hasFin02
        ? fin02Lines.reduce(
            (s, r) => s + normalizeToMonthly(r.rateAmount.toNumber(), r.rateFrequency, weeklyFactor),
            0
          )
        : null;

      // Gross = sum of positive FIN02 lines (before discounts)
      const fin02Gross = hasFin02
        ? fin02Lines.filter((r) => r.rateAmount.toNumber() > 0).reduce((s, r) => s + r.rateAmount.toNumber(), 0)
        : null;

      // Primary item description (largest positive FIN02 line)
      const primaryLine = fin02Lines
        .filter((r) => r.rateAmount.toNumber() > 0)
        .sort((a, b) => b.rateAmount.toNumber() - a.rateAmount.toNumber())[0] ?? null;

      // Breakdown note: "Regular: Full Time 5 Days - Toddler ($3,965.00) | Discount: Standard Discount (-$396.50)"
      const fin02Notes = fin02Lines
        .map((r) => `${r.chargeCode}: ${r.chargeDescription} ($${r.rateAmount.toFixed(2)})`)
        .join(" | ");

      // FIN14 transactions — prefer child-level, fall back to family-level
      const childTxns = (txByChildId.get(child.id) ?? []).filter((t) =>
        RECURRING_HEADS.has(t.subHead ?? "")
      );
      const familyTxns = (txByFamilyId.get(child.familyId) ?? []).filter((t) =>
        RECURRING_HEADS.has(t.subHead ?? "")
      );
      const txns = childTxns.length > 0 ? childTxns : familyTxns;
      const hasFin14 = txns.length > 0;

      const fin14Amount = hasFin14
        ? txns.reduce((s, t) => s + t.chargeAmount.toNumber() - t.creditAmount.toNumber(), 0)
        : null;

      // Variance: positive = expected more than actual (under-billed)
      const variance =
        hasFin02 && hasFin14 ? expectedAmount! - fin14Amount! : null;
      const variancePct =
        variance !== null && expectedAmount && expectedAmount !== 0
          ? Math.min(9999.99, Math.max(-9999.99, (variance / expectedAmount) * 100))
          : null;

      // Status classification
      let reconcStatus: string;
      if (!hasFin02 && !hasFin14) reconcStatus = "NO_DATA";
      else if (!hasFin02)          reconcStatus = "MISSING_FIN02";
      else if (!hasFin14)          reconcStatus = "MISSING_FIN14";
      else if (Math.abs(variance!) <= MATCH_TOLERANCE) reconcStatus = "MATCHED";
      else reconcStatus = "RATE_MISMATCH";

      lines.push({
        childId:         child.childId,
        familyId:        child.family.familyId,
        childName:       child.fullName,
        centerName:      child.center.name,
        program:         enrollment.programCode ?? null,
        classroom:       enrollment.classroom ?? null,
        enrollmentStatus: enrollment.status,
        billingCycle:    enrollment.billingCycle ?? null,
        agencyName:      enrollment.agencyName ?? null,
        fin02Rate:       fin02Gross,            // gross before discount
        fin02Frequency:  primaryLine?.rateFrequency ?? null,
        fin02ChargeCode: primaryLine?.chargeCode ?? null,
        fin02Description: primaryLine?.chargeDescription ?? null,
        fin14Amount,
        fin14TxnCount:   txns.length,
        expectedAmount,                         // net = gross − discounts
        varianceAmount:  variance,
        variancePercent: variancePct,
        reconcStatus,
        notes:           fin02Notes || null,
      });
    }

    // ── NOT_ENROLLED: FIN14 charges for children absent from FC28 ────────────
    for (const [childDbId, txns] of txByChildId) {
      if (processedChildDbIds.has(childDbId)) continue;
      const child = await prisma.child.findUnique({
        where: { id: childDbId },
        include: { family: true, center: true },
      });
      if (!child) continue;
      const recurringTxns = txns.filter((t) => RECURRING_HEADS.has(t.subHead ?? ""));
      const fin14Amount = recurringTxns.reduce(
        (s, t) => s + t.chargeAmount.toNumber() - t.creditAmount.toNumber(),
        0
      );
      lines.push({
        childId:      child.childId,
        familyId:     child.family.familyId,
        childName:    child.fullName,
        centerName:   child.center?.name ?? null,
        fin14Amount,
        fin14TxnCount: recurringTxns.length,
        reconcStatus: "NOT_ENROLLED",
      });
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    const summary = {
      totalChildren: lines.length,
      matched:       lines.filter((l) => l.reconcStatus === "MATCHED").length,
      rateMismatch:  lines.filter((l) => l.reconcStatus === "RATE_MISMATCH").length,
      missingFin14:  lines.filter((l) => l.reconcStatus === "MISSING_FIN14").length,
      missingFin02:  lines.filter((l) => l.reconcStatus === "MISSING_FIN02").length,
      noData:        lines.filter((l) => l.reconcStatus === "NO_DATA").length,
      notEnrolled:   lines.filter((l) => l.reconcStatus === "NOT_ENROLLED").length,
    };

    const recon = await prisma.fin02Reconciliation.create({
      data: { billingPeriod, fin02UploadId, ...summary },
    });

    await prisma.fin02ReconciliationLine.createMany({
      data: lines.map((l) => ({ ...l, reconciliationId: recon.id })),
    });

    return NextResponse.json({ id: recon.id, billingPeriod, ...summary });
  } catch (err: any) {
    console.error("Reconciliation error:", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
