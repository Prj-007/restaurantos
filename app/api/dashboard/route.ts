import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    activeOrders,
    tables,
    allIngredients,
    expenseRecords,
    invoicesWithSupplier,
    purchaseOrders,
    monthlyExpenseRecords,
  ] = await Promise.all([
    prisma.order.count({ where: { status: { in: ["OPEN", "IN_KITCHEN", "SERVED"] } } }),
    prisma.restaurantTable.findMany(),
    prisma.ingredient.findMany(),
    prisma.expenseRecord.findMany({ include: { category: true }, orderBy: { expenseDate: "desc" }, take: 200 }),
    prisma.invoice.findMany({ include: { supplier: true } }),
    prisma.purchaseOrder.findMany(),
    prisma.expenseRecord.findMany({ where: { expenseDate: { gte: startOfMonth } } }),
  ]);

  const lowStockIngredients = allIngredients.filter((i) => i.currentStock <= i.reorderThreshold);

  const tableOccupancy = {
    total: tables.length,
    occupied: tables.filter((t) => t.status === "OCCUPIED").length,
    available: tables.filter((t) => t.status === "AVAILABLE").length,
    reserved: tables.filter((t) => t.status === "RESERVED").length,
  };

  const monthlyExpenseTotal = monthlyExpenseRecords.reduce((sum, r) => sum + r.amount, 0);

  // Expenses by category (all-time, capped sample) — feeds the dashboard pie/bar chart.
  const byCategory = new Map<string, number>();
  for (const r of expenseRecords) {
    byCategory.set(r.category.name, (byCategory.get(r.category.name) ?? 0) + r.amount);
  }
  const expensesByCategory = Array.from(byCategory.entries()).map(([name, value]) => ({ name, value }));

  // Last 6 months of expense totals — feeds the monthly trend chart.
  const monthBuckets: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const label = d.toISOString().slice(0, 7);
    monthBuckets.push({ month: label, total: 0 });
  }
  for (const r of expenseRecords) {
    const label = r.expenseDate.toISOString().slice(0, 7);
    const bucket = monthBuckets.find((b) => b.month === label);
    if (bucket) bucket.total += r.amount;
  }

  // Supplier summary — total spend per supplier from processed invoices.
  const bySupplier = new Map<string, number>();
  for (const inv of invoicesWithSupplier) {
    const name = inv.supplier?.name ?? inv.vendorNameRaw ?? "Unknown";
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + (inv.totalAmount ?? 0));
  }
  const supplierSummary = Array.from(bySupplier.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const purchaseSummary = {
    total: purchaseOrders.reduce((sum, p) => sum + p.totalAmount, 0),
    pending: purchaseOrders.filter((p) => p.status === "PENDING").length,
    received: purchaseOrders.filter((p) => p.status === "RECEIVED").length,
  };

  return NextResponse.json({
    activeOrders,
    tableOccupancy,
    lowStockIngredients: lowStockIngredients.map((i) => ({ name: i.name, currentStock: i.currentStock, unit: i.unit, reorderThreshold: i.reorderThreshold })),
    monthlyExpenseTotal,
    expensesByCategory,
    monthlyTrend: monthBuckets,
    supplierSummary,
    purchaseSummary,
    invoiceCount: invoicesWithSupplier.length,
  });
}
