import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const num = (v: any) => Number(v ?? 0);

/**
 * Billing summary + analysis for the dashboard, mirroring the May report's
 * Summary sheet. Supports filters: entity, state, center, month, year, status,
 * category, agency. Returns totals, category breakdown, and per-center rollup.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: Prisma.BillingFactWhereInput = {};

    // Default to the latest period with data if none specified.
    let billingPeriod = sp.get("period") ?? undefined;
    if (!billingPeriod && !sp.get("year")) {
      const latest = await prisma.billingFact.findFirst({
        orderBy: { billingPeriod: "desc" }, select: { billingPeriod: true },
      });
      billingPeriod = latest?.billingPeriod ?? undefined;
    }
    if (billingPeriod) where.billingPeriod = billingPeriod;
    if (sp.get("year")) where.billingYear = Number(sp.get("year"));
    if (sp.get("month")) where.billingMonth = Number(sp.get("month"));
    if (sp.get("entity")) where.entity = sp.get("entity");
    if (sp.get("state")) where.state = sp.get("state");
    if (sp.get("center")) where.center = { name: sp.get("center")! };
    if (sp.get("status")) where.enrollmentStatus = sp.get("status");
    if (sp.get("agency")) where.agencyName = sp.get("agency");
    if (sp.get("category")) where.varianceCategory = sp.get("category") as any;

    const [totals, baseline, byCategory, byCenter, byEntity, count] = await Promise.all([
      prisma.billingFact.aggregate({
        _sum: {
          expectedAmount: true, actualAmount: true, collectedAmount: true,
          varianceAmount: true, leakageAmount: true, grossBilling: true,
          agencyBilling: true, copayBilling: true,
          actualRegular: true, actualAgency: true, actualDiscount: true,
          actualEarlyLate: true, actualOneTime: true, actualOther: true, actualAdjustments: true,
        },
        where,
      }),
      // Accuracy is only meaningful where an expected baseline exists.
      prisma.billingFact.aggregate({ _sum: { expectedAmount: true, actualAmount: true }, _count: { _all: true }, where: { ...where, expectedAmount: { gt: 0 } } }),
      prisma.billingFact.groupBy({ by: ["varianceCategory"], _count: { _all: true }, _sum: { varianceAmount: true, expectedAmount: true, actualAmount: true }, where }),
      prisma.billingFact.groupBy({ by: ["centerId"], _count: { _all: true }, _sum: { expectedAmount: true, actualAmount: true, varianceAmount: true }, where }),
      prisma.billingFact.groupBy({ by: ["entity"], _count: { _all: true }, _sum: { expectedAmount: true, actualAmount: true, varianceAmount: true }, where }),
      prisma.billingFact.count({ where }),
    ]);

    // Resolve center names for the per-center rollup.
    const centerIds = byCenter.map((c) => c.centerId).filter(Boolean) as string[];
    const centers = await prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, entity: true, state: true } });
    const centerMap = new Map(centers.map((c) => [c.id, c]));

    const t = totals._sum;
    const expected = num(t.expectedAmount), actual = num(t.actualAmount);

    return NextResponse.json({
      period: billingPeriod ?? null,
      totalRecords: count,
      totals: {
        expected, actual, collected: num(t.collectedAmount),
        outstanding: actual - num(t.collectedAmount),
        variance: num(t.varianceAmount), leakage: num(t.leakageAmount),
        gross: num(t.grossBilling), agencyBilling: num(t.agencyBilling), copayBilling: num(t.copayBilling),
        // Billing accuracy over the baseline-eligible population only (expected > 0).
        accuracyPct: num(baseline._sum.expectedAmount) > 0 ? (num(baseline._sum.actualAmount) / num(baseline._sum.expectedAmount)) * 100 : 0,
        baselineKids: baseline._count._all,
      },
      actualBreakdown: {
        regular: num(t.actualRegular), agency: num(t.actualAgency), discount: num(t.actualDiscount),
        earlyLate: num(t.actualEarlyLate), oneTime: num(t.actualOneTime), other: num(t.actualOther),
        adjustments: num(t.actualAdjustments),
      },
      byCategory: byCategory
        .map((c) => ({ category: c.varianceCategory, kids: c._count._all, variance: num(c._sum.varianceAmount), expected: num(c._sum.expectedAmount), actual: num(c._sum.actualAmount) }))
        .sort((a, b) => b.kids - a.kids),
      byEntity: byEntity.map((e) => ({ entity: e.entity ?? "Unmapped", kids: e._count._all, expected: num(e._sum.expectedAmount), actual: num(e._sum.actualAmount), variance: num(e._sum.varianceAmount) })),
      byCenter: byCenter
        .map((c) => ({
          center: c.centerId ? centerMap.get(c.centerId)?.name ?? "Unknown" : "Unknown",
          entity: c.centerId ? centerMap.get(c.centerId)?.entity ?? null : null,
          state: c.centerId ? centerMap.get(c.centerId)?.state ?? null : null,
          kids: c._count._all, expected: num(c._sum.expectedAmount), actual: num(c._sum.actualAmount), variance: num(c._sum.varianceAmount),
        }))
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Distinct filter values for the dashboard's dropdowns. */
export async function POST(req: NextRequest) {
  try {
    const [entities, states, centers, periods, categories, agencies] = await Promise.all([
      prisma.billingFact.findMany({ distinct: ["entity"], select: { entity: true }, where: { entity: { not: null } } }),
      prisma.billingFact.findMany({ distinct: ["state"], select: { state: true }, where: { state: { not: null } } }),
      prisma.center.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.billingFact.findMany({ distinct: ["billingPeriod"], select: { billingPeriod: true }, orderBy: { billingPeriod: "desc" } }),
      prisma.billingFact.findMany({ distinct: ["varianceCategory"], select: { varianceCategory: true } }),
      prisma.billingFact.findMany({ distinct: ["agencyName"], select: { agencyName: true }, where: { agencyName: { not: null } } }),
    ]);
    return NextResponse.json({
      entities: entities.map((e) => e.entity).filter(Boolean),
      states: states.map((s) => s.state).filter(Boolean),
      centers: centers.map((c) => c.name),
      periods: periods.map((p) => p.billingPeriod),
      categories: categories.map((c) => c.varianceCategory),
      agencies: agencies.map((a) => a.agencyName).filter(Boolean),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
