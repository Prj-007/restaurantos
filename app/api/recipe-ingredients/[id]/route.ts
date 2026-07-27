import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const recipeIngredient = await prisma.recipeIngredient.delete({ where: { id } });
  await logActivity(session, "RECIPE_INGREDIENT_REMOVED", "MenuItem", recipeIngredient.menuItemId);
  return NextResponse.json({ ok: true });
}
