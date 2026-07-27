import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: true, expenseCategory: true, lineItems: true },
  });
  return NextResponse.json(invoices);
}

// Persists a reviewed/confirmed invoice draft (see /api/invoices/upload for
// the extraction step that produces this payload).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    fileUrl,
    fileName,
    supplierId,
    expenseCategoryId,
    vendorName,
    invoiceNumber,
    invoiceDate,
    currency,
    subtotal,
    taxAmount,
    totalAmount,
    isHandwritten,
    confidence,
    lineItems,
    rawExtraction,
  } = body;

  if (!fileUrl || !expenseCategoryId || totalAmount == null) {
    return NextResponse.json({ error: "Missing required fields (fileUrl, expenseCategoryId, totalAmount)" }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      supplierId: supplierId || null,
      expenseCategoryId,
      vendorNameRaw: vendorName || null,
      invoiceNumber: invoiceNumber || null,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
      subtotal: subtotal ?? null,
      taxAmount: taxAmount ?? null,
      totalAmount,
      currency: currency || "USD",
      fileUrl,
      fileName,
      isHandwritten: Boolean(isHandwritten),
      ocrConfidence: confidence ?? null,
      rawExtractionJson: rawExtraction ?? undefined,
      status: "PENDING_REVIEW",
      createdById: session.userId,
      lineItems: {
        create: (lineItems || []).map((li: { description: string; quantity: number | null; unitPrice: number | null; lineTotal: number | null }) => ({
          description: li.description,
          quantity: li.quantity ?? null,
          unitPrice: li.unitPrice ?? null,
          lineTotal: li.lineTotal ?? null,
        })),
      },
      expenseRecords: {
        create: {
          categoryId: expenseCategoryId,
          description: `Invoice ${invoiceNumber || ""} — ${vendorName || "Unknown vendor"}`.trim(),
          amount: totalAmount,
          expenseDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          createdById: session.userId,
        },
      },
    },
    include: { lineItems: true, expenseRecords: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}
