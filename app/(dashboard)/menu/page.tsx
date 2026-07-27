"use client";

import { useEffect, useState } from "react";

type Ingredient = { id: string; name: string; unit: string; costPerUnit: number };
type RecipeIngredient = { id: string; quantity: number; ingredient: Ingredient };
type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
  recipeIngredients: RecipeIngredient[];
};
type PriceSuggestion = { suggestedPrice: number; estimatedFoodCost: number; estimatedMarginPercent: number; rationale: string };
type PrepTimeEstimate = { estimatedMinutes: number; complexity: "simple" | "moderate" | "complex"; reasoning: string };

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", price: "", description: "" });
  const [priceSuggestions, setPriceSuggestions] = useState<Record<string, PriceSuggestion | "loading" | "error">>({});
  const [prepEstimates, setPrepEstimates] = useState<Record<string, PrepTimeEstimate | "loading" | "error">>({});
  const [recipeEditorFor, setRecipeEditorFor] = useState<string | null>(null);
  const [recipeForm, setRecipeForm] = useState({ ingredientId: "", quantity: "" });

  async function load() {
    setLoading(true);
    const [itemsRes, ingredientsRes] = await Promise.all([fetch("/api/menu-items"), fetch("/api/ingredients")]);
    setItems(itemsRes.ok ? await itemsRes.json() : []);
    setAllIngredients(ingredientsRes.ok ? await ingredientsRes.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/menu-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", category: "", price: "", description: "" });
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this menu item?")) return;
    await fetch(`/api/menu-items/${id}`, { method: "DELETE" });
    load();
  }

  async function handleSuggestPrice(id: string) {
    setPriceSuggestions((s) => ({ ...s, [id]: "loading" }));
    const res = await fetch(`/api/menu-items/${id}/suggest-price`, { method: "POST" });
    if (!res.ok) return setPriceSuggestions((s) => ({ ...s, [id]: "error" }));
    const json = await res.json();
    setPriceSuggestions((s) => ({ ...s, [id]: json }));
  }

  async function handleEstimatePrepTime(id: string) {
    setPrepEstimates((s) => ({ ...s, [id]: "loading" }));
    const res = await fetch(`/api/menu-items/${id}/estimate-prep-time`, { method: "POST" });
    if (!res.ok) return setPrepEstimates((s) => ({ ...s, [id]: "error" }));
    const json = await res.json();
    setPrepEstimates((s) => ({ ...s, [id]: json }));
  }

  async function handleAddRecipeIngredient(menuItemId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!recipeForm.ingredientId || !recipeForm.quantity) return;
    await fetch("/api/recipe-ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId, ingredientId: recipeForm.ingredientId, quantity: Number(recipeForm.quantity) }),
    });
    setRecipeForm({ ingredientId: "", quantity: "" });
    load();
  }

  async function handleRemoveRecipeIngredient(recipeIngredientId: string) {
    await fetch(`/api/recipe-ingredients/${recipeIngredientId}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Menu Management</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Menu items with recipe-cost-aware AI pricing and prep-time estimates.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {showForm ? "Cancel" : "+ Add item"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:grid-cols-4">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <input required placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <input required type="number" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm" />
          <button type="submit" className="col-span-full rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 w-fit">
            Save
          </button>
        </form>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-zinc-400">No menu items yet.</p>
        ) : (
          items.map((item) => {
            const priceSuggestion = priceSuggestions[item.id];
            const prepEstimate = prepEstimates[item.id];
            const editingRecipe = recipeEditorFor === item.id;
            return (
              <div key={item.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.category}</p>
                  </div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">₹{item.price.toFixed(2)}</p>
                </div>
                {item.description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.description}</p>}

                {item.recipeIngredients.length > 0 && (
                  <ul className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.recipeIngredients.map((ri) => (
                      <li key={ri.id} className="flex items-center justify-between">
                        <span>
                          {ri.quantity} {ri.ingredient.unit} {ri.ingredient.name}
                        </span>
                        {editingRecipe && (
                          <button onClick={() => handleRemoveRecipeIngredient(ri.id)} className="text-red-600 hover:underline">
                            remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={() => setRecipeEditorFor(editingRecipe ? null : item.id)}
                  className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                >
                  {editingRecipe ? "Done editing recipe" : "Edit recipe"}
                </button>

                {editingRecipe && (
                  <form onSubmit={(e) => handleAddRecipeIngredient(item.id, e)} className="mt-2 flex items-center gap-1.5">
                    <select
                      value={recipeForm.ingredientId}
                      onChange={(e) => setRecipeForm({ ...recipeForm, ingredientId: e.target.value })}
                      className="min-w-0 flex-1 rounded border border-zinc-300 dark:border-zinc-700 px-1.5 py-1 text-xs"
                      required
                    >
                      <option value="">Ingredient...</option>
                      {allIngredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Qty"
                      value={recipeForm.quantity}
                      onChange={(e) => setRecipeForm({ ...recipeForm, quantity: e.target.value })}
                      className="w-16 rounded border border-zinc-300 dark:border-zinc-700 px-1.5 py-1 text-xs"
                      required
                    />
                    <button type="submit" className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800">
                      Add
                    </button>
                  </form>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleSuggestPrice(item.id)}
                    disabled={item.recipeIngredients.length === 0 || priceSuggestion === "loading"}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {priceSuggestion === "loading" ? "Thinking..." : "✨ Suggest price"}
                  </button>
                  <button
                    onClick={() => handleEstimatePrepTime(item.id)}
                    disabled={prepEstimate === "loading"}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {prepEstimate === "loading" ? "Thinking..." : "✨ Estimate prep time"}
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="text-xs font-medium text-red-600 hover:underline">
                    Delete
                  </button>
                </div>

                {priceSuggestion && priceSuggestion !== "loading" && priceSuggestion !== "error" && (
                  <div className="mt-3 rounded-md bg-zinc-50 dark:bg-zinc-900 p-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <p>
                      Suggested: <span className="font-semibold">₹{priceSuggestion.suggestedPrice.toFixed(2)}</span> · Food cost ₹
                      {priceSuggestion.estimatedFoodCost.toFixed(2)} · Margin {priceSuggestion.estimatedMarginPercent.toFixed(0)}%
                    </p>
                    <p className="mt-1 text-zinc-500 dark:text-zinc-400">{priceSuggestion.rationale}</p>
                  </div>
                )}
                {priceSuggestion === "error" && <p className="mt-2 text-xs text-red-600">Could not get a suggestion.</p>}

                {prepEstimate && prepEstimate !== "loading" && prepEstimate !== "error" && (
                  <div className="mt-2 rounded-md bg-zinc-50 dark:bg-zinc-900 p-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <p>
                      ~<span className="font-semibold">{prepEstimate.estimatedMinutes} min</span> · {prepEstimate.complexity}
                    </p>
                    <p className="mt-1 text-zinc-500 dark:text-zinc-400">{prepEstimate.reasoning}</p>
                  </div>
                )}
                {prepEstimate === "error" && <p className="mt-2 text-xs text-red-600">Could not estimate prep time.</p>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
