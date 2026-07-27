import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(ingredients);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name || !body.unit) return NextResponse.json({ error: "Name and unit are required" }, { status: 400 });
  const ingredient = await prisma.ingredient.create({
    data: {
      name: body.name,
      unit: body.unit,
      costPerUnit: Number(body.costPerUnit) || 0,
      currentStock: Number(body.currentStock) || 0,
      reorderThreshold: Number(body.reorderThreshold) || 0,
    },
  });
  return NextResponse.json(ingredient, { status: 201 });
}
