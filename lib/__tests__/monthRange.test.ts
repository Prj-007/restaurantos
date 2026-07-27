import { describe, it, expect } from "vitest";
import { getMonthRange } from "@/lib/monthRange";

describe("getMonthRange", () => {
  it("covers exactly one calendar month", () => {
    const { gte, lt } = getMonthRange("2026-02");
    expect(gte.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("rolls over the year correctly for December", () => {
    const { gte, lt } = getMonthRange("2025-12");
    expect(gte.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles a 31-day month without overflowing into the wrong month", () => {
    // A naive `setDate` based approach can be thrown off by day-of-month
    // overflow; getMonthRange operates on the month field only, so this
    // should never be an issue, but it's worth pinning down explicitly.
    const { lt } = getMonthRange("2026-01");
    expect(lt.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(lt.getUTCDate()).toBe(1);
  });
});
