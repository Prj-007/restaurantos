import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ApproveButton from "@/components/ApproveButton";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { supplier: true, expenseCategory: true, lineItems: true, createdBy: true },
  });
  if (!invoice) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{invoice.supplier?.name ?? invoice.vendorNameRaw ?? "Unknown vendor"}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Invoice {invoice.invoiceNumber ?? "—"} · {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : "no date"}
          </p>
        </div>
        <ApproveButton invoiceId={invoice.id} status={invoice.status} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1">Description</th>
                <th className="py-1">Qty</th>
                <th className="py-1">Unit Price</th>
                <th className="py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li) => (
                <tr key={li.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">{li.description}</td>
                  <td className="py-1.5">{li.quantity ?? "—"}</td>
                  <td className="py-1.5">{li.unitPrice ?? "—"}</td>
                  <td className="py-1.5">{li.lineTotal ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            <p>Subtotal: {invoice.subtotal ?? "—"}</p>
            <p>Tax: {invoice.taxAmount ?? "—"}</p>
            <p className="font-semibold">
              Total: {invoice.currency} {invoice.totalAmount ?? "—"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-sm">
          <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Details</p>
          <dl className="mt-2 space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">Category</dt>
              <dd>{invoice.expenseCategory?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">Type</dt>
              <dd>{invoice.isHandwritten ? "Handwritten" : "Printed"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">AI Confidence</dt>
              <dd>{invoice.ocrConfidence != null ? `${Math.round(invoice.ocrConfidence * 100)}%` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">Uploaded by</dt>
              <dd>{invoice.createdBy.name}</dd>
            </div>
          </dl>
          <a href={invoice.fileUrl} target="_blank" rel="noreferrer" className="mt-4 block rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-center text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            View original file
          </a>
        </div>
      </div>
    </div>
  );
}
