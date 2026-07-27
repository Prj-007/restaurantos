"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Invoice = {
  id: string;
  vendorNameRaw: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  isHandwritten: boolean;
  supplier: { name: string } | null;
  expenseCategory: { name: string } | null;
  createdAt: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => {
        setInvoices(data);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Supplier Invoices</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">All invoices processed through AI extraction.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/expense-register/export" className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Export Expense Register (.xlsx)
          </a>
          <Link href="/invoices/upload" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            + Upload Invoice
          </Link>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium">Invoice #</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  Loading...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  No invoices yet — upload one to get started.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <td className="px-4 py-2.5">
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
                      {inv.supplier?.name ?? inv.vendorNameRaw ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">{inv.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">{inv.expenseCategory?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {inv.currency} {inv.totalAmount?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {inv.isHandwritten ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Handwritten</span>
                    ) : (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Printed</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">{inv.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
