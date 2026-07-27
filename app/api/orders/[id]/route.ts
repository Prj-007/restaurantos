import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const order = await prisma.order.update({
    where: { id },
    data: { status: body.status },
    include: { table: true },
  });

  if (body.status === "PAID" && order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "AVAILABLE" } });
  }

  return NextResponse.json(order);
}
