"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LineItem = { description: string; quantity: number | null; unitPrice: number | null; lineTotal: number | null };
type Extraction = {
  vendorName: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  lineItems: LineItem[];
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  isHandwritten: boolean;
  confidence: number;
};
type DraftResult = { fileName: string; fileUrl: string | null; extraction: Extraction | null; error: string | null };
type Supplier = { id: string; name: string };
type Category = { id: string; name: string };

export default function InvoiceUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [drafts, setDrafts] = useState<DraftResult[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [choices, setChoices] = useState<Record<number, { supplierId: string; expenseCategoryId: string }>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/expense-categories").then((r) => r.json()).then((cats) => {
      setCategories(cats);
      setChoices((c) => {
        const next = { ...c };
        return next;
      });
    });
  }, []);

  async function handleUpload() {
    if (files.length === 0) return;
    setProcessing(true);
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const res = await fetch("/api/invoices/upload", { method: "POST", body: formData });
    const body = await res.json();
    setDrafts(body.results ?? []);
    setProcessing(false);
  }

  function updateLineItem(draftIdx: number, itemIdx: number, patch: Partial<LineItem>) {
    setDrafts((ds) =>
      ds.map((d, i) => {
        if (i !== draftIdx || !d.extraction) return d;
        const lineItems = d.extraction.lineItems.map((li, j) => (j === itemIdx ? { ...li, ...patch } : li));
        return { ...d, extraction: { ...d.extraction, lineItems } };
      })
    );
  }

  function updateField(draftIdx: number, patch: Partial<Extraction>) {
    setDrafts((ds) => ds.map((d, i) => (i === draftIdx && d.extraction ? { ...d, extraction: { ...d.extraction, ...patch } } : d)));
  }

  async function handleConfirm(idx: number) {
    const draft = drafts[idx];
    if (!draft.extraction || !draft.fileUrl) return;
    const choice = choices[idx] || { supplierId: "", expenseCategoryId: categories[0]?.id ?? "" };
    if (!choice.expenseCategoryId) {
      alert("Pick an expense category before saving.");
      return;
    }
    setSaving((s) => ({ ...s, [idx]: true }));
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: draft.fileUrl,
        fileName: draft.fileName,
        supplierId: choice.supplierId || null,
        expenseCategoryId: choice.expenseCategoryId,
        vendorName: draft.extraction.vendorName,
        invoiceNumber: draft.extraction.invoiceNumber,
        invoiceDate: draft.extraction.invoiceDate,
        currency: draft.extraction.currency,
        subtotal: draft.extraction.subtotal,
        taxAmount: draft.extraction.taxAmount,
        totalAmount: draft.extraction.totalAmount,
        isHandwritten: draft.extraction.isHandwritten,
        confidence: draft.extraction.confidence,
        lineItems: draft.extraction.lineItems,
        rawExtraction: draft.extraction,
      }),
    });
    setSaving((s) => ({ ...s, [idx]: false }));
    if (res.ok) setSaved((s) => ({ ...s, [idx]: true }));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">AI Invoice Processing</h1>
      <p className="text-sm text-zinc-500">
        Upload printed or handwritten supplier invoices (image or PDF). Gemini extracts the data — review and correct it, then confirm to
        save it to the database and the expense register.
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mx-auto block text-sm"
        />
        {files.length > 0 && <p className="mt-2 text-xs text-zinc-500">{files.length} file(s) selected</p>}
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || processing}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
        >
          {processing ? "Extracting with AI..." : "Upload & Extract"}
        </button>
      </div>

      <div className="mt-6 space-y-6">
        {drafts.map((draft, idx) => (
          <div key={idx} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-900">{draft.fileName}</p>
              {draft.extraction && (
                <div className="flex items-center gap-2 text-xs">
                  {draft.extraction.isHandwritten && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">Handwritten</span>
                  )}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                    Confidence {Math.round(draft.extraction.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            {draft.error && <p className="mt-2 text-sm text-red-600">Extraction failed: {draft.error}</p>}

            {draft.extraction && (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Vendor</label>
                    <input
                      value={draft.extraction.vendorName ?? ""}
                      onChange={(e) => updateField(idx, { vendorName: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Invoice #</label>
                    <input
                      value={draft.extraction.invoiceNumber ?? ""}
                      onChange={(e) => updateField(idx, { invoiceNumber: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Date</label>
                    <input
                      type="date"
                      value={draft.extraction.invoiceDate ?? ""}
                      onChange={(e) => updateField(idx, { invoiceDate: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Currency</label>
                    <input
                      value={draft.extraction.currency ?? ""}
                      onChange={(e) => updateField(idx, { currency: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </div>
                </div>

                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="py-1">Description</th>
                      <th className="py-1 w-20">Qty</th>
                      <th className="py-1 w-24">Unit Price</th>
                      <th className="py-1 w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.extraction.lineItems.map((li, itemIdx) => (
                      <tr key={itemIdx} className="border-t border-zinc-100">
                        <td className="py-1 pr-2">
                          <input
                            value={li.description}
                            onChange={(e) => updateLineItem(idx, itemIdx, { description: e.target.value })}
                            className="w-full rounded border border-zinc-200 px-1.5 py-0.5"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            value={li.quantity ?? ""}
                            onChange={(e) => updateLineItem(idx, itemIdx, { quantity: Number(e.target.value) })}
                            className="w-full rounded border border-zinc-200 px-1.5 py-0.5"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            value={li.unitPrice ?? ""}
                            onChange={(e) => updateLineItem(idx, itemIdx, { unitPrice: Number(e.target.value) })}
                            className="w-full rounded border border-zinc-200 px-1.5 py-0.5"
                          />
                        </td>
                        <td className="py-1">
                          <input
                            type="number"
                            value={li.lineTotal ?? ""}
                            onChange={(e) => updateLineItem(idx, itemIdx, { lineTotal: Number(e.target.value) })}
                            className="w-full rounded border border-zinc-200 px-1.5 py-0.5"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Subtotal</label>
                    <input
                      type="number"
                      value={draft.extraction.subtotal ?? ""}
                      onChange={(e) => updateField(idx, { subtotal: Number(e.target.value) })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Tax</label>
                    <input
                      type="number"
                      value={draft.extraction.taxAmount ?? ""}
                      onChange={(e) => updateField(idx, { taxAmount: Number(e.target.value) })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Total</label>
                    <input
                      type="number"
                      value={draft.extraction.totalAmount ?? ""}
                      onChange={(e) => updateField(idx, { totalAmount: Number(e.target.value) })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 font-semibold"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Match supplier (optional)</label>
                    <select
                      value={choices[idx]?.supplierId ?? ""}
                      onChange={(e) => setChoices((c) => ({ ...c, [idx]: { ...c[idx], supplierId: e.target.value, expenseCategoryId: c[idx]?.expenseCategoryId ?? categories[0]?.id ?? "" } }))}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">No match / new supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Expense category</label>
                    <select
                      value={choices[idx]?.expenseCategoryId ?? categories[0]?.id ?? ""}
                      onChange={(e) => setChoices((c) => ({ ...c, [idx]: { supplierId: c[idx]?.supplierId ?? "", expenseCategoryId: e.target.value } }))}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => handleConfirm(idx)}
                    disabled={saving[idx] || saved[idx]}
                    className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {saved[idx] ? "Saved ✓" : saving[idx] ? "Saving..." : "Confirm & Save"}
                  </button>
                  {saved[idx] && (
                    <button onClick={() => router.push("/invoices")} className="text-sm font-medium text-blue-600 hover:underline">
                      View in Invoices →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
