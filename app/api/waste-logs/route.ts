import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logs = await prisma.wasteLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { ingredient: true, loggedBy: true },
    take: 200,
  });
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.ingredientId || body.quantity == null) {
    return NextResponse.json({ error: "ingredientId and quantity are required" }, { status: 400 });
  }
  const log = await prisma.wasteLog.create({
    data: {
      ingredientId: body.ingredientId,
      quantity: Number(body.quantity),
      reason: body.reason || null,
      loggedById: session.userId,
    },
    include: { ingredient: true },
  });
  await logActivity(session, "WASTE_LOGGED", "Ingredient", log.ingredientId, { quantity: log.quantity, reason: log.reason });
  return NextResponse.json(log, { status: 201 });
}
