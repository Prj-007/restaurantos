"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

type DashboardData = {
  activeOrders: number;
  tableOccupancy: { total: number; occupied: number; available: number; reserved: number };
  lowStockIngredients: { name: string; currentStock: number; unit: string; reorderThreshold: number }[];
  monthlyExpenseTotal: number;
  expensesByCategory: { name: string; value: number }[];
  monthlyTrend: { month: string; total: number }[];
  supplierSummary: { name: string; total: number }[];
  purchaseSummary: { total: number; pending: number; received: number };
  invoiceCount: number;
};

const COLORS = ["#18181b", "#52525b", "#a1a1aa", "#d4d4d8", "#71717a", "#3f3f46"];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-zinc-400">Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Orders" value={data.activeOrders} />
        <StatCard label="Table Occupancy" value={`${data.tableOccupancy.occupied}/${data.tableOccupancy.total}`} sub="occupied" />
        <StatCard label="Low Stock Items" value={data.lowStockIngredients.length} />
        <StatCard label="Monthly Expenses" value={`₹${data.monthlyExpenseTotal.toFixed(0)}`} />
        <StatCard label="Purchase Orders" value={`₹${data.purchaseSummary.total.toFixed(0)}`} sub={`${data.purchaseSummary.pending} pending`} />
        <StatCard label="Invoices Processed" value={data.invoiceCount} sub="via AI" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-700">Monthly Expense Trend (6 mo)</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-700">Expenses by Category</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.expensesByCategory} dataKey="value" nameKey="name" outerRadius={90} label={(d) => d.name}>
                  {data.expensesByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-700">Supplier Summary (top spend)</p>
          <ul className="mt-3 space-y-2 text-sm">
            {data.supplierSummary.length === 0 && <li className="text-zinc-400">No invoice data yet.</li>}
            {data.supplierSummary.map((s) => (
              <li key={s.name} className="flex justify-between border-b border-zinc-100 pb-1.5">
                <span className="text-zinc-700">{s.name}</span>
                <span className="font-medium text-zinc-900">₹{s.total.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-700">Low Stock Items</p>
          <ul className="mt-3 space-y-2 text-sm">
            {data.lowStockIngredients.length === 0 && <li className="text-zinc-400">Everything is well stocked.</li>}
            {data.lowStockIngredients.map((i) => (
              <li key={i.name} className="flex justify-between border-b border-zinc-100 pb-1.5">
                <span className="text-zinc-700">{i.name}</span>
                <span className="font-medium text-red-600">
                  {i.currentStock} {i.unit} (reorder at {i.reorderThreshold})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
