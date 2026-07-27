import { describe, it, expect } from "vitest";
import { computeFoodCost } from "@/lib/gemini";

describe("computeFoodCost", () => {
  it("sums quantity x cost-per-unit across ingredients", () => {
    const cost = computeFoodCost([
      { quantity: 0.2, costPerUnit: 40 }, // Tomato
      { quantity: 0.15, costPerUnit: 550 }, // Mozzarella
    ]);
    expect(cost).toBeCloseTo(0.2 * 40 + 0.15 * 550);
  });

  it("returns 0 for an empty recipe", () => {
    expect(computeFoodCost([])).toBe(0);
  });
});
