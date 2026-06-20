import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const num = (v: any) => Number(v ?? 0);

/** Paginated, filterable, searchable list of billing-fact rows for the data table. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 50)));
    const sortBy = sp.get("sortBy") ?? "variance";
    const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";

    const where: Prisma.BillingFactWhereInput = {};
    let period = sp.get("period") ?? undefined;
    if (!period && !sp.get("year")) {
      const latest = await prisma.billingFact.findFirst({ orderBy: { billingPeriod: "desc" }, select: { billingPeriod: true } });
      period = latest?.billingPeriod ?? undefined;
    }
    if (period) where.billingPeriod = period;
    if (sp.get("year")) where.billingYear = Number(sp.get("year"));
    if (sp.get("month")) where.billingMonth = Number(sp.get("month"));
    if (sp.get("entity")) where.entity = sp.get("entity");
    if (sp.get("state")) where.state = sp.get("state");
    if (sp.get("center")) where.center = { name: sp.get("center")! };
    if (sp.get("status")) where.enrollmentStatus = sp.get("status");
    if (sp.get("agency")) where.agencyName = sp.get("agency");
    if (sp.get("category")) where.varianceCategory = sp.get("category") as any;

    const q = (sp.get("q") ?? "").trim();
    if (q) {
      where.child = {
        is: { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { childId: { contains: q } }] },
      };
    }

    const orderBy: Prisma.BillingFactOrderByWithRelationInput =
      sortBy === "expected" ? { expectedAmount: sortDir }
      : sortBy === "actual" ? { actualAmount: sortDir }
      : sortBy === "name" ? { child: { fullName: sortDir } }
      : { varianceAmount: sortDir };

    const [total, rows] = await Promise.all([
      prisma.billingFact.count({ where }),
      prisma.billingFact.findMany({
        where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
        include: { child: { select: { childId: true, fullName: true } }, center: { select: { name: true } } },
      }),
    ]);

    return NextResponse.json({
      page, pageSize, total, totalPages: Math.ceil(total / pageSize),
      rows: rows.map((r) => ({
        id: r.id,
        childId: r.child?.childId ?? "", childName: r.child?.fullName ?? "",
        entity: r.entity, state: r.state, center: r.center?.name ?? "",
        status: r.enrollmentStatus, agency: r.agencyName, billingCycle: r.billingCycle,
        period: r.billingPeriod, daysBilled: r.finalDaysBilled,
        gross: num(r.grossBilling), expected: num(r.expectedAmount), actual: num(r.actualAmount),
        // Recurring actual = what is comparable to Expected (tuition + agency + early/late, net of discounts).
        recurringActual: num(r.actualRegular) + num(r.actualAgency) + num(r.actualEarlyLate) + num(r.actualDiscount),
        regular: num(r.actualRegular), agencyBilled: num(r.actualAgency), discount: num(r.actualDiscount),
        earlyLate: num(r.actualEarlyLate), oneTime: num(r.actualOneTime),
        other: num(r.actualOther), adjustments: num(r.actualAdjustments),
        collected: num(r.collectedAmount), variance: num(r.varianceAmount), variancePct: num(r.variancePercent),
        category: r.varianceCategory, billingStatus: r.billingStatus,
        remark: r.remark, detailedRemark: r.detailedRemark,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
