// Shared by /api/expense-records and /api/expense-register/export, both of
// which accept an optional ?month=YYYY-MM filter. Extracted so the
// year-rollover edge case (December -> January) is tested once, not
// duplicated (and possibly re-broken) in two route handlers.
export function getMonthRange(month: string): { gte: Date; lt: Date } {
  const gte = new Date(`${month}-01T00:00:00.000Z`);
  const lt = new Date(gte);
  lt.setUTCMonth(lt.getUTCMonth() + 1);
  return { gte, lt };
}
