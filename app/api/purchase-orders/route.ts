import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orders = await prisma.purchaseOrder.findMany({ orderBy: { orderedAt: "desc" }, include: { supplier: true } });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.supplierId) return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
  const order = await prisma.purchaseOrder.create({
    data: {
      supplierId: body.supplierId,
      totalAmount: Number(body.totalAmount) || 0,
      status: body.status || "PENDING",
    },
  });
  return NextResponse.json(order, { status: 201 });
}
