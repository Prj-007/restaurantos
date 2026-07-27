import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeShortagesAndReorder } from "@/lib/gemini";

// AI feature: predicts ingredient shortages and recommends reorder quantities.
// "Recent usage" is derived from real data — order items placed in the last 7
// days, expanded through each menu item's recipe into ingredient quantities —
// rather than being a made-up number.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [ingredients, recentOrderItems] = await Promise.all([
    prisma.ingredient.findMany(),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      include: { menuItem: { include: { recipeIngredients: true } } },
    }),
  ]);

  if (ingredients.length === 0) {
    return NextResponse.json({ error: "No ingredients to analyze" }, { status: 400 });
  }

  const usageByIngredient = new Map<string, number>();
  for (const oi of recentOrderItems) {
    for (const ri of oi.menuItem.recipeIngredients) {
      usageByIngredient.set(ri.ingredientId, (usageByIngredient.get(ri.ingredientId) ?? 0) + ri.quantity * oi.quantity);
    }
  }

  const analysis = await analyzeShortagesAndReorder({
    ingredients: ingredients.map((i) => ({
      name: i.name,
      unit: i.unit,
      currentStock: i.currentStock,
      reorderThreshold: i.reorderThreshold,
      recentUsage: usageByIngredient.get(i.id) ?? 0,
    })),
  });

  return NextResponse.json(analysis);
}
