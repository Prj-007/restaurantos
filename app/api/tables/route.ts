import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tables = await prisma.restaurantTable.findMany({ orderBy: { number: "asc" } });
  return NextResponse.json(tables);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const table = await prisma.restaurantTable.create({
    data: { number: Number(body.number), capacity: Number(body.capacity) || 4 },
  });
  return NextResponse.json(table, { status: 201 });
}
