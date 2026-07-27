import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.menuItem.findMany({
    orderBy: { name: "asc" },
    include: { recipeIngredients: { include: { ingredient: true } } },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name || !body.category) return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
  const item = await prisma.menuItem.create({
    data: {
      name: body.name,
      category: body.category,
      price: Number(body.price) || 0,
      description: body.description || null,
    },
  });
  await logActivity(session, "MENU_ITEM_CREATED", "MenuItem", item.id, { name: item.name });
  return NextResponse.json(item, { status: 201 });
}
