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
type Suggestion = { suggestedPrice: number; estimatedFoodCost: number; estimatedMarginPercent: number; rationale: string };

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", price: "", description: "" });
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | "loading" | "error">>({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/menu-items");
    setItems(res.ok ? await res.json() : []);
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
    setSuggestions((s) => ({ ...s, [id]: "loading" }));
    const res = await fetch(`/api/menu-items/${id}/suggest-price`, { method: "POST" });
    if (!res.ok) {
      setSuggestions((s) => ({ ...s, [id]: "error" }));
      return;
    }
    const json = await res.json();
    setSuggestions((s) => ({ ...s, [id]: json }));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Menu Management</h1>
          <p className="text-sm text-zinc-500">Menu items with recipe-cost-aware AI pricing suggestions.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {showForm ? "Cancel" : "+ Add item"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-4">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
          <input required placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
          <input required type="number" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
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
            const s = suggestions[item.id];
            return (
              <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.category}</p>
                  </div>
                  <p className="font-semibold text-zinc-900">₹{item.price.toFixed(2)}</p>
                </div>
                {item.description && <p className="mt-1 text-sm text-zinc-500">{item.description}</p>}

                {item.recipeIngredients.length > 0 && (
                  <ul className="mt-2 text-xs text-zinc-500">
                    {item.recipeIngredients.map((ri) => (
                      <li key={ri.id}>
                        {ri.quantity} {ri.ingredient.unit} {ri.ingredient.name}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => handleSuggestPrice(item.id)}
                    disabled={item.recipeIngredients.length === 0 || s === "loading"}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    {s === "loading" ? "Thinking..." : "✨ Suggest AI price"}
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="text-xs font-medium text-red-600 hover:underline">
                    Delete
                  </button>
                </div>

                {s && s !== "loading" && s !== "error" && (
                  <div className="mt-3 rounded-md bg-zinc-50 p-2.5 text-xs text-zinc-700">
                    <p>
                      Suggested: <span className="font-semibold">₹{s.suggestedPrice.toFixed(2)}</span> · Food cost ₹
                      {s.estimatedFoodCost.toFixed(2)} · Margin {s.estimatedMarginPercent.toFixed(0)}%
                    </p>
                    <p className="mt-1 text-zinc-500">{s.rationale}</p>
                  </div>
                )}
                {s === "error" && <p className="mt-2 text-xs text-red-600">Could not get a suggestion.</p>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
