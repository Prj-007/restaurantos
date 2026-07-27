"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { isAllowed } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/invoices", label: "Invoices (AI)", icon: "🧾" },
  { href: "/expenses", label: "Expenses", icon: "💳" },
  { href: "/suppliers", label: "Suppliers", icon: "🚚" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "📦" },
  { href: "/menu", label: "Menu", icon: "🍽️" },
  { href: "/ingredients", label: "Ingredients", icon: "🥕" },
  { href: "/tables", label: "Tables", icon: "🪑" },
  { href: "/orders", label: "Orders", icon: "🧑‍🍳" },
  { href: "/staff", label: "Staff", icon: "👥" },
];

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => isAllowed(item.href, role));

  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white sm:block">
      <div className="px-5 py-5">
        <span className="text-lg font-semibold tracking-tight text-zinc-900">RestaurantOS</span>
      </div>
      <nav className="space-y-1 px-3">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
