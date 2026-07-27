import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMonthRange } from "@/lib/monthRange";

// Generates the Expense Register .xlsx required by the assessment: one row
// per expense record (whether it came from an AI-processed invoice or was
// entered manually), optionally filtered to a single month via ?month=YYYY-MM.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month"); // e.g. "2026-02"
  const where = month ? { expenseDate: getMonthRange(month) } : {};

  const records = await prisma.expenseRecord.findMany({
    where,
    include: {
      category: true,
      invoice: { include: { supplier: true } },
      createdBy: true,
    },
    orderBy: { expenseDate: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RestaurantOS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Expense Register");
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "category", width: 22 },
    { header: "Supplier", key: "supplier", width: 24 },
    { header: "Invoice #", key: "invoiceNumber", width: 16 },
    { header: "Description", key: "description", width: 36 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Source", key: "source", width: 14 },
    { header: "Recorded By", key: "recordedBy", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of records) {
    sheet.addRow({
      date: r.expenseDate.toISOString().slice(0, 10),
      category: r.category.name,
      supplier: r.invoice?.supplier?.name ?? r.invoice?.vendorNameRaw ?? "—",
      invoiceNumber: r.invoice?.invoiceNumber ?? "—",
      description: r.description,
      amount: r.amount,
      currency: r.invoice?.currency ?? "USD",
      source: r.invoiceId ? "AI Invoice" : "Manual",
      recordedBy: r.createdBy.name,
    });
  }

  const total = records.reduce((sum, r) => sum + r.amount, 0);
  const totalRow = sheet.addRow({ description: "TOTAL", amount: total });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="expense-register${month ? `-${month}` : ""}.xlsx"`,
    },
  });
}
