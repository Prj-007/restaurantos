import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const supplier = await prisma.supplier.update({ where: { id }, data: body });
  await logActivity(session, "SUPPLIER_UPDATED", "Supplier", supplier.id);
  return NextResponse.json(supplier);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supplier = await prisma.supplier.delete({ where: { id } });
  await logActivity(session, "SUPPLIER_DELETED", "Supplier", id, { name: supplier.name });
  return NextResponse.json({ ok: true });
}
