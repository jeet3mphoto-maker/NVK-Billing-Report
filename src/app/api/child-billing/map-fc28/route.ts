import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const db = prisma as any;
const enc = new TextEncoder();

function sse(data: object) {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// POST /api/child-billing/map-fc28
// Looks up each child by childId in the latest FC28 batch and merges FC28 fields into rawData.
export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sse({ phase: "init", message: "Loading child billing rows…" }));

        const batch = await db.childBillingBatch.findFirst({ orderBy: { createdAt: "desc" } });
        if (!batch) {
          controller.enqueue(sse({ phase: "error", message: "No child billing data found. Run Aggregate first." }));
          controller.close();
          return;
        }

        // Get all unique childIds from child billing
        const childRows: { childId: string }[] = await prisma.$queryRawUnsafe(
          `SELECT DISTINCT "childId" FROM "ChildBillingRow" WHERE "batchId" = $1 AND "childId" IS NOT NULL`,
          batch.id
        );
        const childIds = childRows.map((r) => r.childId).filter(Boolean);
        const total    = childIds.length;

        controller.enqueue(sse({ phase: "init", message: `Found ${total} children — loading FC28 data…`, total }));

        // Load FC28 data for matching children
        const latestFC28 = await db.fC28Batch.findFirst({ orderBy: { reportDate: "desc" } });
        const fc28Records = latestFC28
          ? await db.fC28Row.findMany({ where: { batchId: latestFC28.id, childId: { in: childIds } }, orderBy: { childId: "asc" } })
          : [];

        const fc28Map = new Map<string, any>(fc28Records.map((r: any) => [String(r.childId), r]));

        controller.enqueue(sse({ phase: "mapping", message: `Loaded ${fc28Map.size} FC28 records — mapping…`, total, done: 0, mapped: 0, unmapped: 0, pct: 0 }));

        const BATCH_SIZE = 500;
        let mapped = 0, unmapped = 0, done = 0;

        for (let i = 0; i < childIds.length; i += BATCH_SIZE) {
          const chunk = childIds.slice(i, i + BATCH_SIZE);
          const valueParts: string[] = [];
          const params: any[] = [];
          let pi = 1;

          for (const childId of chunk) {
            const fc28 = fc28Map.get(childId);
            if (!fc28) { unmapped++; continue; }

            const b = (v: boolean | null | undefined) => v == null ? "" : v ? "Yes" : "No";
            const s = (v: any) => v ?? "";
            const patch = {
              "Child Status (FC28)":       s(fc28.childStatus),
              "Family Status (FC28)":      s(fc28.familyStatus),
              "Classroom (FC28)":          s(fc28.classroom),
              "Rate Sheet (FC28)":         s(fc28.rateSheet),
              "Date of Birth (FC28)":      s(fc28.dateOfBirth),
              "Enroll Date (FC28)":        s(fc28.enrollDate),
              "Start Date (FC28)":         s(fc28.startDate),
              "Withdrawal Date (FC28)":    s(fc28.withdrawalDate),
              "Withdrawal Reason (FC28)":  s(fc28.withdrawalReason),
              "Primary Guardian (FC28)":   s(fc28.primaryGuardian),
              "Mon (FC28)":                b(fc28.monDay),
              "Tue (FC28)":                b(fc28.tueDay),
              "Wed (FC28)":                b(fc28.wedDay),
              "Thu (FC28)":                b(fc28.thuDay),
              "Fri (FC28)":                b(fc28.friDay),
              "Drop Off (FC28)":           s(fc28.dropOff),
              "Pickup (FC28)":             s(fc28.pickup),
              "Early AM Care (FC28)":      s(fc28.earlyAMCare),
              "Late PM Care (FC28)":       s(fc28.latePMCare),
              "Program (FC28)":            s(fc28.program),
              "Discount Type (FC28)":      s(fc28.discountType),
              "Discount Name (FC28)":      s(fc28.discountName),
              "Main Discount (FC28)":      s(fc28.mainDiscount),
              "AM/PM Discount (FC28)":     s(fc28.amPmDiscount),
              "Total Discount (FC28)":     s(fc28.totalDiscount),
              "Billing Cycle (FC28)":      s(fc28.billingCycle),
              "Agency 1 (FC28)":           s(fc28.agency1),
              "Family Contrib 1 (FC28)":   s(fc28.familyContrib1),
              "Estimated Contract Amount 1 (FC28)": s(fc28.contractAmt1),
              "Contract Period 1 (FC28)":           s(fc28.contractPeriod1),
              "Copay Amt 1 (FC28)":                 s(fc28.copayAmt1),
              "Copay Period 1 (FC28)":              s(fc28.copayPeriod1),
              "Agency 2 (FC28)":                    s(fc28.agency2),
              "Family Contrib 2 (FC28)":            s(fc28.familyContrib2),
              "Estimated Contract Amount 2 (FC28)": s(fc28.contractAmt2),
              "Contract Period 2 (FC28)":           s(fc28.contractPeriod2),
              "Copay Amt 2 (FC28)":                 s(fc28.copayAmt2),
              "Copay Period 2 (FC28)":              s(fc28.copayPeriod2),
              "Rate Card Key (FC28)":          s(fc28.rateCardKey),
              "Revised Classroom (FC28)":      s(fc28.revisedClassroom),
              "Early AM Rate Card Key (FC28)": s(fc28.earlyAMRateCardKey),
              "Late PM Rate Card Key (FC28)":  s(fc28.latePMRateCardKey),
            };

            valueParts.push(`($${pi}::text, $${pi + 1}::jsonb)`);
            params.push(childId, JSON.stringify(patch));
            pi += 2;
            mapped++;
          }

          if (valueParts.length > 0) {
            await prisma.$executeRawUnsafe(
              `UPDATE "ChildBillingRow" AS t
               SET    "rawData" = t."rawData" || v.patch
               FROM   (VALUES ${valueParts.join(",")}) AS v(child_id, patch)
               WHERE  t."childId" = v.child_id
                 AND  t."batchId" = $${pi}`,
              ...params, batch.id
            );
          }

          done = Math.min(i + chunk.length, total);
          controller.enqueue(sse({ phase: "mapping", done, total, mapped, unmapped, pct: Math.round((done / total) * 100) }));
        }

        controller.enqueue(sse({ phase: "complete", done: total, total, mapped, unmapped, pct: 100, message: `Done — ${mapped} children mapped, ${unmapped} not in FC28` }));
      } catch (err: any) {
        controller.enqueue(sse({ phase: "error", message: err.message ?? "Mapping failed" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}
