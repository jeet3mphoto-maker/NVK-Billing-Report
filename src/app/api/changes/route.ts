import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** FC28 change log (real data) with summary counts and optional type filter. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 50)));

    const where = type && type !== "ALL" ? { changeType: type as any } : {};

    const [counts, total, rows] = await Promise.all([
      prisma.fC28ChangeLog.groupBy({ by: ["changeType"], _count: { _all: true } }),
      prisma.fC28ChangeLog.count({ where }),
      prisma.fC28ChangeLog.findMany({
        where, orderBy: { snapshotDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);

    // Resolve child names.
    const childIds = [...new Set(rows.map((r) => r.childId))];
    const children = await prisma.child.findMany({ where: { id: { in: childIds } }, select: { id: true, childId: true, fullName: true } });
    const cmap = new Map(children.map((c) => [c.id, c]));

    const countOf = (t: string) => counts.find((c) => c.changeType === t)?._count._all ?? 0;

    return NextResponse.json({
      summary: { newChildren: countOf("NEW_CHILD"), removedChildren: countOf("REMOVED_CHILD"), fieldChanges: countOf("FIELD_CHANGED") },
      total, page, pageSize, totalPages: Math.ceil(total / pageSize),
      rows: rows.map((r) => ({
        id: r.id,
        childId: cmap.get(r.childId)?.childId ?? "",
        childName: cmap.get(r.childId)?.fullName ?? "(unknown)",
        field: r.fieldName, oldValue: r.oldValue, newValue: r.newValue,
        type: r.changeType, date: r.snapshotDate,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
