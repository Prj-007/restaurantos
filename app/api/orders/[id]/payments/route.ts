import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { publishOrderUpdate } from "@/lib/realtime";
import type { PaymentMethod } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "UPI", "OTHER"];
const EPSILON = 0.01; // cents-level float slack when comparing paid total to bill total

function orderTotal(items: { quantity: number; unitPrice: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

// Record one payment toward an order's bill — this is what "splitting the
// bill" is: a waiter/cashier records several payments (evenly split, split
// by item, or arbitrary amounts) against the same order. Once the sum
// covers the total, the order is marked PAID automatically.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const amount = Number(body.amount);
  const method: PaymentMethod = PAYMENT_METHODS.includes(body.method) ? body.method : "CASH";
  const label: string | null = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, payments: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "PAID" || order.status === "CANCELLED") {
    return NextResponse.json({ error: `Order is already ${order.status}` }, { status: 400 });
  }

  const total = orderTotal(order.items);
  const paidSoFar = order.payments.reduce((s, p) => s + p.amount, 0);
  if (paidSoFar + amount > total + EPSILON) {
    return NextResponse.json(
      { error: `Payment exceeds remaining balance (₹${(total - paidSoFar).toFixed(2)} left)` },
      { status: 400 }
    );
  }

  await prisma.payment.create({ data: { orderId: id, amount, method, label } });

  const nowPaid = paidSoFar + amount >= total - EPSILON;
  const updated = await prisma.order.update({
    where: { id },
    data: nowPaid ? { status: "PAID" } : {},
    include: { table: true, items: { include: { menuItem: true } }, payments: true },
  });

  if (nowPaid && updated.tableId) {
    await prisma.restaurantTable.update({ where: { id: updated.tableId }, data: { status: "AVAILABLE" } });
  }

  await logActivity(session, "PAYMENT_RECORDED", "Order", id, { amount, method, label, orderPaid: nowPaid });
  await publishOrderUpdate(updated);

  return NextResponse.json(updated, { status: 201 });
}
