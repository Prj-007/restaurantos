import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

// Links an ingredient (with a quantity) onto a menu item's recipe.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { menuItemId, ingredientId, quantity } = body;
  if (!menuItemId || !ingredientId || !quantity) {
    return NextResponse.json({ error: "menuItemId, ingredientId and quantity are required" }, { status: 400 });
  }

  const recipeIngredient = await prisma.recipeIngredient.upsert({
    where: { menuItemId_ingredientId: { menuItemId, ingredientId } },
    update: { quantity: Number(quantity) },
    create: { menuItemId, ingredientId, quantity: Number(quantity) },
    include: { ingredient: true },
  });

  await logActivity(session, "RECIPE_INGREDIENT_LINKED", "MenuItem", menuItemId, {
    ingredient: recipeIngredient.ingredient.name,
    quantity: recipeIngredient.quantity,
  });

  return NextResponse.json(recipeIngredient, { status: 201 });
}
