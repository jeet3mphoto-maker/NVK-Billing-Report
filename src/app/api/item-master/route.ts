import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const db = prisma as any;

// GET /api/item-master — list all active items
export async function GET() {
  const items = await db.itemMaster.findMany({
    where: { isActive: true },
    orderBy: [{ majorHead: "asc" }, { subHead: "asc" }, { item: "asc" }],
  });
  return NextResponse.json(items);
}

// POST /api/item-master — add a new item
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { item, majorHead, subHead, entryBy } = body;
  if (!item || !majorHead || !subHead) {
    return NextResponse.json({ error: "item, majorHead and subHead are required" }, { status: 400 });
  }
  const created = await db.itemMaster.create({
    data: { item: item.trim(), majorHead, subHead, entryBy: entryBy ?? "Manual" },
  });
  return NextResponse.json(created, { status: 201 });
}

// PATCH /api/item-master — update an existing item
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, item, majorHead, subHead } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updated = await db.itemMaster.update({
    where: { id: Number(id) },
    data: { ...(item && { item }), ...(majorHead && { majorHead }), ...(subHead && { subHead }) },
  });
  return NextResponse.json(updated);
}

// DELETE /api/item-master — soft-delete (deactivate)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.itemMaster.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
