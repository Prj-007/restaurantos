import { describe, it, expect } from "vitest";
import { deriveOrderStatus } from "@/lib/orderStatus";

describe("deriveOrderStatus", () => {
  it("stays OPEN while every item is still PENDING", () => {
    expect(deriveOrderStatus(["PENDING", "PENDING"])).toBe("OPEN");
  });

  it("moves to IN_KITCHEN as soon as any item leaves PENDING", () => {
    expect(deriveOrderStatus(["PENDING", "IN_KITCHEN"])).toBe("IN_KITCHEN");
    expect(deriveOrderStatus(["READY", "PENDING"])).toBe("IN_KITCHEN");
  });

  it("only reaches SERVED once every item is SERVED", () => {
    expect(deriveOrderStatus(["SERVED", "READY"])).toBe("IN_KITCHEN");
    expect(deriveOrderStatus(["SERVED", "SERVED"])).toBe("SERVED");
  });

  it("does not report SERVED for an order with no items", () => {
    // .every() on an empty array is vacuously true, which would otherwise
    // mark a zero-item order as fully served.
    expect(deriveOrderStatus([])).toBe("OPEN");
  });
});
