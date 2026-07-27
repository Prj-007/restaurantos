"use client";

import CrudTable from "@/components/CrudTable";

export default function SuppliersPage() {
  return (
    <CrudTable
      title="Suppliers"
      endpoint="/api/suppliers"
      columns={[
        { key: "name", label: "Name" },
        { key: "contactName", label: "Contact" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "taxId", label: "Tax ID" },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "contactName", label: "Contact Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email", type: "email" },
        { key: "address", label: "Address" },
        { key: "taxId", label: "Tax ID" },
      ]}
    />
  );
}
