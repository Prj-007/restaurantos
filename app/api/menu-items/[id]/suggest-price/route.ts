import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestMenuPrice } from "@/lib/gemini";

type RouteContext = { params: Promise<{ id: string }> };

// AI feature: suggest a menu price from the item's linked recipe cost.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: { recipeIngredients: { include: { ingredient: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.recipeIngredients.length === 0) {
    return NextResponse.json({ error: "This menu item has no linked recipe ingredients yet" }, { status: 400 });
  }

  const suggestion = await suggestMenuPrice({
    menuItemName: item.name,
    currentPrice: item.price,
    ingredients: item.recipeIngredients.map((ri) => ({
      name: ri.ingredient.name,
      quantity: ri.quantity,
      unit: ri.ingredient.unit,
      costPerUnit: ri.ingredient.costPerUnit,
    })),
  });

  return NextResponse.json(suggestion);
}
