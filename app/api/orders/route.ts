import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { table: true, items: { include: { menuItem: true } } },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const items: { menuItemId: string; quantity: number; unitPrice: number }[] = body.items || [];
  if (items.length === 0) return NextResponse.json({ error: "Add at least one item" }, { status: 400 });

  const order = await prisma.order.create({
    data: {
      tableId: body.tableId || null,
      items: { create: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, unitPrice: i.unitPrice })) },
    },
    include: { table: true, items: { include: { menuItem: true } } },
  });

  if (body.tableId) {
    await prisma.restaurantTable.update({ where: { id: body.tableId }, data: { status: "OCCUPIED" } });
  }

  return NextResponse.json(order, { status: 201 });
}
