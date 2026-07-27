"use client";

import { useEffect, useState } from "react";
import CrudTable from "@/components/CrudTable";

export default function PurchaseOrdersPage() {
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string }[] | null>(null);

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((suppliers) => setSupplierOptions(suppliers.map((s: { id: string; name: string }) => ({ value: s.id, label: s.name }))));
  }, []);

  if (!supplierOptions) return <p className="text-zinc-400">Loading...</p>;

  return (
    <CrudTable
      title="Purchase Orders"
      endpoint="/api/purchase-orders"
      columns={[
        { key: "supplier", label: "Supplier", render: (row) => ((row.supplier as { name?: string })?.name ?? "—") },
        { key: "totalAmount", label: "Total Amount" },
        { key: "status", label: "Status" },
      ]}
      fields={[
        { key: "supplierId", label: "Supplier", type: "select", required: true, options: supplierOptions },
        { key: "totalAmount", label: "Total Amount", type: "number", required: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "PENDING", label: "Pending" },
            { value: "RECEIVED", label: "Received" },
            { value: "CANCELLED", label: "Cancelled" },
          ],
        },
      ]}
    />
  );
}
