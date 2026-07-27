import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { publishOrderUpdate } from "@/lib/realtime";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const order = await prisma.order.update({
    where: { id },
    data: { status: body.status },
    include: { table: true, items: { include: { menuItem: true } } },
  });

  if (body.status === "PAID" && order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "AVAILABLE" } });
  }

  await logActivity(session, "ORDER_STATUS_CHANGED", "Order", order.id, { status: order.status });
  await publishOrderUpdate(order);

  return NextResponse.json(order);
}
