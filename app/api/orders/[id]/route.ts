import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { publishOrderUpdate } from "@/lib/realtime";

type RouteContext = { params: Promise<{ id: string }> };

// OPEN -> IN_KITCHEN -> SERVED are derived automatically from per-item status
// (see items/[itemId]/route.ts) and PAID is set once payments cover the total
// (see payments/route.ts). The only status change left for this endpoint is
// cancelling an order outright.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (body.status !== "CANCELLED") {
    return NextResponse.json({ error: "Only cancelling an order is supported here" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (existing.status === "PAID" || existing.status === "CANCELLED") {
    return NextResponse.json({ error: `Order is already ${existing.status}` }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: { table: true, items: { include: { menuItem: true } }, payments: true },
  });

  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "AVAILABLE" } });
  }

  await logActivity(session, "ORDER_STATUS_CHANGED", "Order", order.id, { status: order.status });
  await publishOrderUpdate(order);

  return NextResponse.json(order);
}
