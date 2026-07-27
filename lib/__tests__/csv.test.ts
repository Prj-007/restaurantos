import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("splits a simple comma-delimited file into rows and fields", () => {
    const rows = parseCsv("Date,Category,Description,Amount\n2026-01-01,Utilities,Electricity,120.5\n");
    expect(rows).toEqual([
      ["Date", "Category", "Description", "Amount"],
      ["2026-01-01", "Utilities", "Electricity", "120.5"],
    ]);
  });

  it("handles quoted fields containing commas and escaped quotes", () => {
    const rows = parseCsv('a,"b, with comma",c\n1,"she said ""hi""",3');
    expect(rows).toEqual([
      ["a", "b, with comma", "c"],
      ["1", 'she said "hi"', "3"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips blank lines", () => {
    const rows = parseCsv("a,b\n\n1,2\n\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
