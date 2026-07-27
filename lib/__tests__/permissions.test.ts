import { describe, it, expect } from "vitest";
import { isAllowed, ROUTE_PERMISSIONS, ALL_ROLES } from "@/lib/permissions";

describe("isAllowed", () => {
  it("allows an unlisted route (e.g. /login) for any role", () => {
    expect(isAllowed("/login", "WAITER")).toBe(true);
  });

  it("allows OWNER on every listed route (owner is always a superuser)", () => {
    for (const rule of ROUTE_PERMISSIONS) {
      expect(isAllowed(rule.prefix, "OWNER")).toBe(true);
    }
  });

  it("blocks WAITER from finance-only routes", () => {
    expect(isAllowed("/suppliers", "WAITER")).toBe(false);
    expect(isAllowed("/staff", "WAITER")).toBe(false);
    expect(isAllowed("/audit-log", "WAITER")).toBe(false);
  });

  it("allows WAITER on operational routes", () => {
    expect(isAllowed("/orders", "WAITER")).toBe(true);
    expect(isAllowed("/tables", "WAITER")).toBe(true);
  });

  it("matches nested paths by prefix (e.g. /expenses/categories)", () => {
    expect(isAllowed("/expenses/categories", "MANAGER")).toBe(true);
    expect(isAllowed("/expenses/categories", "CHEF")).toBe(false);
  });

  it("restricts the audit log to Owner/Manager only", () => {
    const allowedRoles = ALL_ROLES.filter((role) => isAllowed("/audit-log", role));
    expect(allowedRoles.sort()).toEqual(["MANAGER", "OWNER"]);
  });

  it("restricts CASHIER from ingredient/menu management", () => {
    expect(isAllowed("/menu", "CASHIER")).toBe(false);
    expect(isAllowed("/ingredients", "CASHIER")).toBe(false);
  });
});
