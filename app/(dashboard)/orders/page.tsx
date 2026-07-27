"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrdersRealtime } from "@/lib/useOrdersRealtime";

type MenuItem = { id: string; name: string; price: number };
type Table = { id: string; number: number };
type OrderItem = { id: string; quantity: number; unitPrice: number; menuItem: MenuItem };
type Order = { id: string; status: string; createdAt: string; table: Table | null; items: OrderItem[] };

const STATUS_FLOW = ["OPEN", "IN_KITCHEN", "SERVED", "PAID"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, t, m] = await Promise.all([
      fetch("/api/orders").then((r) => r.json()),
      fetch("/api/tables").then((r) => r.json()),
      fetch("/api/menu-items").then((r) => r.json()),
    ]);
    setOrders(o);
    setTables(t);
    setMenuItems(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: whenever any user creates an order or advances its status,
  // every open Orders page (e.g. a kitchen display) refetches automatically.
  useOrdersRealtime(useCallback(() => load(), [load]));

  async function handleCreateOrder() {
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => {
        const mi = menuItems.find((m) => m.id === menuItemId)!;
        return { menuItemId, quantity, unitPrice: mi.price };
      });
    if (items.length === 0) return;
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: tableId || null, items }),
    });
    setCart({});
    setTableId("");
    load();
  }

  async function advanceStatus(order: Order) {
    const idx = STATUS_FLOW.indexOf(order.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Order Management</h1>
        {process.env.NEXT_PUBLIC_PUSHER_KEY && (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
          </span>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New order</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-sm">
            <option value="">No table (takeaway)</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {menuItems.map((mi) => (
            <div key={mi.id} className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-sm">
              <span>{mi.name}</span>
              <input
                type="number"
                min={0}
                value={cart[mi.id] ?? 0}
                onChange={(e) => setCart((c) => ({ ...c, [mi.id]: Number(e.target.value) }))}
                className="ml-2 w-14 rounded border border-zinc-300 dark:border-zinc-700 px-1 py-0.5 text-right"
              />
            </div>
          ))}
        </div>
        <button onClick={handleCreateOrder} className="mt-3 rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
          Place order
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-zinc-400">No orders yet.</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {o.table ? `Table ${o.table.number}` : "Takeaway"} · {new Date(o.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">{o.status}</span>
                  {o.status !== "PAID" && o.status !== "CANCELLED" && (
                    <button onClick={() => advanceStatus(o)} className="text-xs font-medium text-blue-600 hover:underline">
                      Advance →
                    </button>
                  )}
                </div>
              </div>
              <ul className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {o.items.map((it) => (
                  <li key={it.id}>
                    {it.quantity} x {it.menuItem.name} — ₹{(it.quantity * it.unitPrice).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
