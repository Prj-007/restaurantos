import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";

// Imports manual expense records from a CSV with header row:
// Date, Category, Description, Amount — the same columns the .xlsx export
// produces for manual entries (Supplier/Invoice#/Source/Recorded By are
// export-only, since an import always creates a manual, non-invoice record).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const categoryIdx = header.indexOf("category");
  const descriptionIdx = header.indexOf("description");
  const amountIdx = header.indexOf("amount");
  if (dateIdx === -1 || categoryIdx === -1 || descriptionIdx === -1 || amountIdx === -1) {
    return NextResponse.json(
      { error: "CSV header must include Date, Category, Description, Amount" },
      { status: 400 }
    );
  }

  const categories = await prisma.expenseCategory.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  const errors: { row: number; reason: string }[] = [];
  const toCreate: { categoryId: string; description: string; amount: number; expenseDate: Date }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const lineNo = i + 1; // 1-indexed with header as line 1, matches what a spreadsheet app shows
    const dateStr = r[dateIdx]?.trim();
    const categoryName = r[categoryIdx]?.trim();
    const description = r[descriptionIdx]?.trim();
    const amountStr = r[amountIdx]?.trim();

    const category = categoryName ? categoryByName.get(categoryName.toLowerCase()) : undefined;
    const amount = Number(amountStr);
    const expenseDate = dateStr ? new Date(dateStr) : null;

    if (!category) {
      errors.push({ row: lineNo, reason: `Unknown category "${categoryName ?? ""}"` });
      continue;
    }
    if (!description) {
      errors.push({ row: lineNo, reason: "Missing description" });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ row: lineNo, reason: `Invalid amount "${amountStr ?? ""}"` });
      continue;
    }
    if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
      errors.push({ row: lineNo, reason: `Invalid date "${dateStr ?? ""}"` });
      continue;
    }

    toCreate.push({ categoryId: category.id, description, amount, expenseDate });
  }

  if (toCreate.length > 0) {
    await prisma.expenseRecord.createMany({
      data: toCreate.map((r) => ({ ...r, createdById: session.userId })),
    });
    await logActivity(session, "EXPENSE_RECORDS_IMPORTED", "ExpenseRecord", null, {
      count: toCreate.length,
      errorCount: errors.length,
      fileName: file.name,
    });
  }

  return NextResponse.json({ imported: toCreate.length, skipped: errors.length, errors });
}
