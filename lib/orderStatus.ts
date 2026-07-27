import type { OrderItemStatus } from "@prisma/client";

// Order.status tracks the overall bill lifecycle (…SERVED -> PAID/CANCELLED,
// set directly by billing actions). Everything up to SERVED is derived here
// from the item statuses so the kitchen/waiter flow and the order pill never
// drift apart.
export function deriveOrderStatus(itemStatuses: OrderItemStatus[]): "OPEN" | "IN_KITCHEN" | "SERVED" {
  if (itemStatuses.length > 0 && itemStatuses.every((s) => s === "SERVED")) return "SERVED";
  if (itemStatuses.some((s) => s !== "PENDING")) return "IN_KITCHEN";
  return "OPEN";
}
