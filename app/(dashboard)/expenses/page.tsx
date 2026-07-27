"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ExpenseRecord = {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  category: { name: string };
  invoice: { invoiceNumber: string | null; supplier: { name: string } | null } | null;
  createdBy: { name: string };
};
type Category = { id: string; name: string };

export default function ExpensesPage() {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ categoryId: "", description: "", amount: "", expenseDate: "" });

  async function load() {
    setLoading(true);
    const url = month ? `/api/expense-records?month=${month}` : "/api/expense-records";
    const res = await fetch(url);
    setRecords(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/expense-categories").then((r) => r.json()).then(setCategories);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/expense-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ categoryId: "", description: "", amount: "", expenseDate: "" });
    setShowForm(false);
    load();
  }

  const total = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Expense Records</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Monthly expense tracking, combining AI-processed invoices and manual entries.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <a href={`/api/expense-register/export${month ? `?month=${month}` : ""}`} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Export .xlsx
          </a>
          <Link href="/expenses/categories" className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Categories
          </Link>
          <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            {showForm ? "Cancel" : "+ Manual expense"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:grid-cols-4">
          <select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm">
            <option value="">Category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <input required type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <button type="submit" className="col-span-full w-fit rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            Save
          </button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  Loading...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  No expense records for this period.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">{new Date(r.expenseDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">{r.category.name}</td>
                  <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">{r.description}</td>
                  <td className="px-4 py-2.5">
                    {r.invoice ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">AI Invoice</span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Manual</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">₹{r.amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
          {records.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 dark:border-zinc-800 font-semibold">
                <td colSpan={4} className="px-4 py-2.5 text-right">
                  Total
                </td>
                <td className="px-4 py-2.5">₹{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
