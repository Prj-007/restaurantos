"use client";

import { useEffect, useState } from "react";

export type CrudField = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type CrudColumn = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

// One reusable list+create+delete component used by every "simple" CRUD
// module (Suppliers, Expense Categories, Menu, Ingredients, Staff, Tables).
// Keeping every module on the same shape keeps the codebase easy to explain:
// there is exactly one CRUD pattern, not five slightly different ones.
export default function CrudTable({
  title,
  endpoint,
  columns,
  fields,
  emptyMessage = "Nothing here yet.",
}: {
  title: string;
  endpoint: string;
  columns: CrudColumn[];
  fields: CrudField[];
  emptyMessage?: string;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(endpoint);
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      payload[f.key] = f.type === "number" ? Number(form[f.key] || 0) : form[f.key] || "";
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create");
      return;
    }
    setForm({});
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-zinc-600">{f.label}</label>
              {f.type === "select" ? (
                <select
                  required={f.required}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none"
                >
                  <option value="">Select...</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                  required={f.required}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none"
                />
              )}
            </div>
          ))}
          <div className="col-span-full flex items-center gap-3">
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
              Save
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2.5 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-zinc-400">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-zinc-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id as string} className="hover:bg-zinc-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-zinc-700">
                      {c.render ? c.render(row) : ((row[c.key] as string) ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(row.id as string)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
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
