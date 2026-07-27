"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrdersRealtime } from "@/lib/useOrdersRealtime";

type MenuItem = { id: string; name: string; price: number };
type Table = { id: string; number: number };
type OrderItem = { id: string; quantity: number; unitPrice: number; status: string; menuItem: MenuItem };
type Payment = { id: string; amount: number; method: string; label: string | null; createdAt: string };
type Order = { id: string; status: string; createdAt: string; table: Table | null; items: OrderItem[]; payments: Payment[] };

const ITEM_STATUS_FLOW = ["PENDING", "IN_KITCHEN", "READY", "SERVED"];
const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_KITCHEN: "In kitchen",
  READY: "Ready",
  SERVED: "Served",
};
const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "OTHER"];

function orderTotal(order: Order) {
  return order.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

function paidTotal(order: Order) {
  return order.payments.reduce((sum, p) => sum + p.amount, 0);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [splitCount, setSplitCount] = useState<Record<string, number>>({});
  const [customAmount, setCustomAmount] = useState<Record<string, string>>({});
  const [customMethod, setCustomMethod] = useState<Record<string, string>>({});

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

  // Live updates: whenever any user creates an order, advances an item, or
  // records a payment, every open Orders page (e.g. a kitchen display)
  // refetches automatically.
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

  async function advanceItem(orderId: string, item: OrderItem) {
    const idx = ITEM_STATUS_FLOW.indexOf(item.status);
    const next = ITEM_STATUS_FLOW[idx + 1];
    if (!next) return;
    await fetch(`/api/orders/${orderId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function cancelOrder(orderId: string) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    load();
  }

  async function recordPayment(orderId: string, amount: number, method: string, label: string | null) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const res = await fetch(`/api/orders/${orderId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, label }),
    });
    if (res.ok) load();
  }

  async function splitEvenly(order: Order, n: number) {
    if (n < 1) return;
    const remaining = orderTotal(order) - paidTotal(order);
    const already = order.payments.length;
    // Split what's left into n equal shares, cents rounded onto the last share.
    const share = Math.floor((remaining / n) * 100) / 100;
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const amount = isLast ? Number((remaining - share * (n - 1)).toFixed(2)) : share;
      if (amount <= 0) continue;
      await fetch(`/api/orders/${order.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: "CASH", label: `Split ${already + i + 1}/${already + n}` }),
      });
    }
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
          orders.map((o) => {
            const total = orderTotal(o);
            const paid = paidTotal(o);
            const remaining = Math.max(0, total - paid);
            const canBill = o.status !== "PAID" && o.status !== "CANCELLED";
            return (
              <div key={o.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {o.table ? `Table ${o.table.number}` : "Takeaway"} · {new Date(o.createdAt).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">{o.status}</span>
                    {canBill && (
                      <button onClick={() => cancelOrder(o.id)} className="text-xs font-medium text-red-600 hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800 text-sm text-zinc-600 dark:text-zinc-400">
                  {o.items.map((it) => {
                    const nextStatus = ITEM_STATUS_FLOW[ITEM_STATUS_FLOW.indexOf(it.status) + 1];
                    return (
                      <li key={it.id} className="flex items-center justify-between py-1.5">
                        <span>
                          {it.quantity} x {it.menuItem.name} — ₹{(it.quantity * it.unitPrice).toFixed(2)}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium">
                            {ITEM_STATUS_LABEL[it.status]}
                          </span>
                          {canBill && nextStatus && (
                            <button onClick={() => advanceItem(o.id, it)} className="text-xs font-medium text-blue-600 hover:underline">
                              Mark {ITEM_STATUS_LABEL[nextStatus]} →
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 rounded-md bg-zinc-50 dark:bg-zinc-950 p-3 text-sm">
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                    <span>Total ₹{total.toFixed(2)}</span>
                    <span>Paid ₹{paid.toFixed(2)}</span>
                    <span className={remaining > 0 ? "font-medium text-amber-600" : "font-medium text-green-600"}>
                      {remaining > 0 ? `Remaining ₹${remaining.toFixed(2)}` : "Fully paid"}
                    </span>
                  </div>

                  {o.payments.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
                      {o.payments.map((p) => (
                        <li key={p.id}>
                          ₹{p.amount.toFixed(2)} · {p.method}
                          {p.label ? ` · ${p.label}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canBill && remaining > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-zinc-500">Split evenly</span>
                        <input
                          type="number"
                          min={2}
                          value={splitCount[o.id] ?? 2}
                          onChange={(e) => setSplitCount((s) => ({ ...s, [o.id]: Number(e.target.value) }))}
                          className="w-12 rounded border border-zinc-300 dark:border-zinc-700 px-1 py-0.5 text-right text-xs"
                        />
                        <button
                          onClick={() => splitEvenly(o, splitCount[o.id] ?? 2)}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          ways
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Amount"
                          value={customAmount[o.id] ?? ""}
                          onChange={(e) => setCustomAmount((s) => ({ ...s, [o.id]: e.target.value }))}
                          className="w-20 rounded border border-zinc-300 dark:border-zinc-700 px-1 py-0.5 text-xs"
                        />
                        <select
                          value={customMethod[o.id] ?? "CASH"}
                          onChange={(e) => setCustomMethod((s) => ({ ...s, [o.id]: e.target.value }))}
                          className="rounded border border-zinc-300 dark:border-zinc-700 px-1 py-0.5 text-xs"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const amt = Number(customAmount[o.id]);
                            recordPayment(o.id, amt, customMethod[o.id] ?? "CASH", null);
                            setCustomAmount((s) => ({ ...s, [o.id]: "" }));
                          }}
                          className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800"
                        >
                          Record payment
                        </button>
                        <button
                          onClick={() => recordPayment(o.id, remaining, customMethod[o.id] ?? "CASH", "Full balance")}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Pay full ₹{remaining.toFixed(2)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
