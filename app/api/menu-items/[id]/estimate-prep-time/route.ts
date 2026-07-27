import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimatePrepTime } from "@/lib/gemini";

type RouteContext = { params: Promise<{ id: string }> };

// AI feature: estimate food preparation time for a menu item.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: { recipeIngredients: { include: { ingredient: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const estimate = await estimatePrepTime({
    menuItemName: item.name,
    category: item.category,
    ingredients: item.recipeIngredients.map((ri) => ({ name: ri.ingredient.name, quantity: ri.quantity, unit: ri.ingredient.unit })),
  });

  return NextResponse.json(estimate);
}
