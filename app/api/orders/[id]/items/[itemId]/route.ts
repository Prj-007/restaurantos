import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { publishOrderUpdate } from "@/lib/realtime";
import { deriveOrderStatus } from "@/lib/orderStatus";
import type { OrderItemStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

const ITEM_STATUS_FLOW: OrderItemStatus[] = ["PENDING", "IN_KITCHEN", "READY", "SERVED"];

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  const body = await req.json();
  const status = body.status as OrderItemStatus;

  if (!ITEM_STATUS_FLOW.includes(status)) {
    return NextResponse.json({ error: "Invalid item status" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "PAID" || order.status === "CANCELLED") {
    return NextResponse.json({ error: `Order is already ${order.status}` }, { status: 400 });
  }
  const item = order.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "Order item not found" }, { status: 404 });

  await prisma.orderItem.update({ where: { id: itemId }, data: { status } });

  const nextItemStatuses = order.items.map((i) => (i.id === itemId ? status : i.status));
  const nextOrderStatus = deriveOrderStatus(nextItemStatuses);

  const updated = await prisma.order.update({
    where: { id },
    data: { status: nextOrderStatus },
    include: { table: true, items: { include: { menuItem: true } }, payments: true },
  });

  await logActivity(session, "ORDER_ITEM_STATUS_CHANGED", "OrderItem", itemId, {
    orderId: id,
    status,
    orderStatus: nextOrderStatus,
  });
  await publishOrderUpdate(updated);

  return NextResponse.json(updated);
}
