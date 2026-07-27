"use client";

import { useEffect, useState } from "react";
import CrudTable from "@/components/CrudTable";

type Ingredient = { id: string; name: string; unit: string; costPerUnit: number };
type WasteLog = { id: string; quantity: number; reason: string | null; createdAt: string; ingredient: { name: string; unit: string } };
type ShortagePrediction = {
  ingredientName: string;
  daysUntilShortage: number | null;
  urgency: "critical" | "soon" | "monitor";
  recommendedReorderQuantity: number;
  reasoning: string;
};
type ShortageAnalysis = { predictions: ShortagePrediction[]; summary: string };
type WasteAnalysis = { topOffenders: { ingredientName: string; totalWasted: number; unit: string; estimatedCost: number }[]; recommendations: string[]; summary: string };

const URGENCY_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-700",
  monitor: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
};

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [wasteForm, setWasteForm] = useState({ ingredientId: "", quantity: "", reason: "" });
  const [shortageResult, setShortageResult] = useState<ShortageAnalysis | "loading" | "error" | null>(null);
  const [wasteResult, setWasteResult] = useState<WasteAnalysis | "loading" | "error" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/ingredients").then((r) => r.json()).then(setIngredients);
    fetch("/api/waste-logs").then((r) => r.json()).then(setWasteLogs);
  }, [refreshKey]);

  async function handleAnalyzeShortages() {
    setShortageResult("loading");
    const res = await fetch("/api/ingredients/analyze-shortages", { method: "POST" });
    if (!res.ok) return setShortageResult("error");
    setShortageResult(await res.json());
  }

  async function handleLogWaste(e: React.FormEvent) {
    e.preventDefault();
    if (!wasteForm.ingredientId || !wasteForm.quantity) return;
    await fetch("/api/waste-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wasteForm),
    });
    setWasteForm({ ingredientId: "", quantity: "", reason: "" });
    setRefreshKey((k) => k + 1);
  }

  async function handleAnalyzeWaste() {
    setWasteResult("loading");
    const res = await fetch("/api/waste-logs/analyze", { method: "POST" });
    if (!res.ok) return setWasteResult("error");
    setWasteResult(await res.json());
  }

  return (
    <div className="space-y-6">
      <CrudTable
        title="Ingredients"
        endpoint="/api/ingredients"
        columns={[
          { key: "name", label: "Name" },
          { key: "unit", label: "Unit" },
          { key: "costPerUnit", label: "Cost/Unit" },
          { key: "currentStock", label: "Current Stock" },
          {
            key: "reorderThreshold",
            label: "Status",
            render: (row) =>
              (row.currentStock as number) <= (row.reorderThreshold as number) ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Reorder</span>
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
              ),
          },
        ]}
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "unit", label: "Unit (kg, litre...)", required: true },
          { key: "costPerUnit", label: "Cost per unit", type: "number", required: true },
          { key: "currentStock", label: "Current stock", type: "number" },
          { key: "reorderThreshold", label: "Reorder threshold", type: "number" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">✨ AI: Shortage Prediction & Reorder Quantities</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Based on current stock and the last 7 days of order-driven ingredient usage.</p>
            </div>
            <button
              onClick={handleAnalyzeShortages}
              disabled={shortageResult === "loading"}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {shortageResult === "loading" ? "Analyzing..." : "Run analysis"}
            </button>
          </div>

          {shortageResult === "error" && <p className="mt-3 text-sm text-red-600">Analysis failed.</p>}
          {shortageResult && shortageResult !== "loading" && shortageResult !== "error" && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{shortageResult.summary}</p>
              <ul className="space-y-1.5">
                {shortageResult.predictions.map((p) => (
                  <li key={p.ingredientName} className="rounded-md bg-zinc-50 dark:bg-zinc-900 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.ingredientName}</span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${URGENCY_STYLE[p.urgency]}`}>{p.urgency}</span>
                    </div>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                      {p.daysUntilShortage != null ? `~${p.daysUntilShortage}d until shortage` : "insufficient usage data"} · reorder{" "}
                      {p.recommendedReorderQuantity}
                    </p>
                    <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">{p.reasoning}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Log Ingredient Waste</p>
          </div>
          <form onSubmit={handleLogWaste} className="mt-2 grid grid-cols-3 gap-2">
            <select
              value={wasteForm.ingredientId}
              onChange={(e) => setWasteForm({ ...wasteForm, ingredientId: e.target.value })}
              className="col-span-3 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm sm:col-span-1"
              required
            >
              <option value="">Ingredient...</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Qty wasted"
              value={wasteForm.quantity}
              onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm"
              required
            />
            <input
              placeholder="Reason (optional)"
              value={wasteForm.reason}
              onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm"
            />
            <button type="submit" className="col-span-3 w-fit rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 sm:col-span-1">
              Log
            </button>
          </form>

          <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs text-zinc-500 dark:text-zinc-400">
            {wasteLogs.slice(0, 8).map((w) => (
              <li key={w.id}>
                {new Date(w.createdAt).toLocaleDateString()} — {w.quantity} {w.ingredient.unit} {w.ingredient.name}
                {w.reason ? ` (${w.reason})` : ""}
              </li>
            ))}
            {wasteLogs.length === 0 && <li>No waste logged yet.</li>}
          </ul>

          <button
            onClick={handleAnalyzeWaste}
            disabled={wasteResult === "loading" || wasteLogs.length === 0}
            className="mt-3 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
          >
            {wasteResult === "loading" ? "Analyzing..." : "✨ AI: Analyze waste"}
          </button>

          {wasteResult === "error" && <p className="mt-2 text-xs text-red-600">Analysis failed.</p>}
          {wasteResult && wasteResult !== "loading" && wasteResult !== "error" && (
            <div className="mt-3 rounded-md bg-zinc-50 dark:bg-zinc-900 p-2.5 text-xs text-zinc-700 dark:text-zinc-300">
              <p className="text-zinc-600 dark:text-zinc-400">{wasteResult.summary}</p>
              <ul className="mt-1.5 list-disc pl-4">
                {wasteResult.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
