import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeWaste } from "@/lib/gemini";

// AI feature: analyze logged ingredient waste and recommend reductions.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.wasteLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { ingredient: true },
    take: 100,
  });

  if (logs.length === 0) {
    return NextResponse.json({ error: "No waste logs to analyze yet" }, { status: 400 });
  }

  const analysis = await analyzeWaste({
    wasteLogs: logs.map((l) => ({
      ingredientName: l.ingredient.name,
      unit: l.ingredient.unit,
      quantity: l.quantity,
      costPerUnit: l.ingredient.costPerUnit,
      reason: l.reason,
      date: l.createdAt.toISOString().slice(0, 10),
    })),
  });

  return NextResponse.json(analysis);
}
