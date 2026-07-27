import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month");
  const where = month
    ? {
        expenseDate: {
          gte: new Date(`${month}-01T00:00:00.000Z`),
          lt: new Date(new Date(`${month}-01T00:00:00.000Z`).setUTCMonth(new Date(`${month}-01T00:00:00.000Z`).getUTCMonth() + 1)),
        },
      }
    : {};

  const records = await prisma.expenseRecord.findMany({
    where,
    include: { category: true, invoice: { include: { supplier: true } }, createdBy: true },
    orderBy: { expenseDate: "desc" },
  });
  return NextResponse.json(records);
}

// Manual expense entry (not tied to an AI-processed invoice).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.categoryId || !body.description || body.amount == null) {
    return NextResponse.json({ error: "categoryId, description and amount are required" }, { status: 400 });
  }
  const record = await prisma.expenseRecord.create({
    data: {
      categoryId: body.categoryId,
      description: body.description,
      amount: Number(body.amount),
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
      createdById: session.userId,
    },
  });
  return NextResponse.json(record, { status: 201 });
}
