import type { Role } from "@prisma/client";

// Single source of truth for RBAC: which roles may open which section of the
// app. Checked in middleware.ts (route guard) and re-used in the UI to hide
// nav links the current user can't use anyway.
export const ROUTE_PERMISSIONS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard", roles: ["OWNER", "MANAGER", "CHEF", "WAITER", "CASHIER"] },
  { prefix: "/invoices", roles: ["OWNER", "MANAGER", "CASHIER"] },
  { prefix: "/expenses", roles: ["OWNER", "MANAGER", "CASHIER"] },
  { prefix: "/suppliers", roles: ["OWNER", "MANAGER"] },
  { prefix: "/purchase-orders", roles: ["OWNER", "MANAGER"] },
  { prefix: "/menu", roles: ["OWNER", "MANAGER", "CHEF"] },
  { prefix: "/ingredients", roles: ["OWNER", "MANAGER", "CHEF"] },
  { prefix: "/tables", roles: ["OWNER", "MANAGER", "WAITER", "CASHIER"] },
  { prefix: "/orders", roles: ["OWNER", "MANAGER", "WAITER", "CASHIER", "CHEF"] },
  { prefix: "/staff", roles: ["OWNER", "MANAGER"] },
  { prefix: "/audit-log", roles: ["OWNER", "MANAGER"] },
];

export function isAllowed(pathname: string, role: Role): boolean {
  const rule = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return true; // unlisted routes (e.g. /login) are not role-gated here
  return rule.roles.includes(role);
}

export const ALL_ROLES: Role[] = ["OWNER", "MANAGER", "CHEF", "WAITER", "CASHIER"];
