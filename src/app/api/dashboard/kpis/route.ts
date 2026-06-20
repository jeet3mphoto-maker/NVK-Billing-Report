import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    // Default to the most recent period that actually has calculated facts, not the
    // literal current calendar month — data is typically imported a month in arrears,
    // so keying off "today" would show an empty dashboard right after an import.
    const latestFact = await prisma.billingFact.findFirst({
      orderBy: { billingPeriod: "desc" },
      select: { billingPeriod: true },
    });
    const billingPeriod =
      latestFact?.billingPeriod ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [
      activeChildren,
      activeCenters,
      openIssues,
      criticalIssues,
      monthlyFacts,
      baselineFacts,
    ] = await Promise.all([
      prisma.child.count({ where: { isActive: true } }),
      prisma.center.count({ where: { isActive: true } }),
      prisma.billingIssue.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
      prisma.billingIssue.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
      prisma.billingFact.aggregate({
        _sum: { expectedAmount: true, actualAmount: true, collectedAmount: true, leakageAmount: true, varianceAmount: true },
        where: { billingPeriod },
      }),
      // Accuracy is only meaningful for children that HAVE an expected baseline,
      // so compute it over that subset (expectedAmount > 0) — otherwise total
      // actual (all children) ÷ expected (subsidy only) gives a nonsense ratio.
      prisma.billingFact.aggregate({
        _sum: { expectedAmount: true, actualAmount: true },
        where: { billingPeriod, expectedAmount: { gt: 0 } },
      }),
    ]);

    const expected   = Number(monthlyFacts._sum.expectedAmount ?? 0);
    const actual     = Number(monthlyFacts._sum.actualAmount ?? 0);
    const collected  = Number(monthlyFacts._sum.collectedAmount ?? 0);
    const leakage    = Number(monthlyFacts._sum.leakageAmount ?? 0);
    const variance   = Number(monthlyFacts._sum.varianceAmount ?? 0);

    // Accuracy over the baseline-eligible population only.
    const baselineExpected = Number(baselineFacts._sum.expectedAmount ?? 0);
    const baselineActual   = Number(baselineFacts._sum.actualAmount ?? 0);
    const accuracy = baselineExpected > 0 ? (baselineActual / baselineExpected) * 100 : 0;

    return NextResponse.json({
      activeChildren,
      activeCenters,
      openIssues,
      criticalIssues,
      expectedRevenue: expected,
      actualRevenue: actual,
      collectedRevenue: collected,
      outstandingRevenue: actual - collected,
      leakageAmount: leakage,
      billingAccuracy: accuracy,
      varianceAmount: variance,
      billingPeriod,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
