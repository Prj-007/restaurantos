"use client";

import CrudTable from "@/components/CrudTable";

export default function TablesPage() {
  return (
    <CrudTable
      title="Table Management"
      endpoint="/api/tables"
      columns={[
        { key: "number", label: "Table #" },
        { key: "capacity", label: "Capacity" },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                row.status === "AVAILABLE"
                  ? "bg-green-100 text-green-700"
                  : row.status === "OCCUPIED"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {row.status as string}
            </span>
          ),
        },
      ]}
      fields={[
        { key: "number", label: "Table number", type: "number", required: true },
        { key: "capacity", label: "Capacity", type: "number", required: true },
      ]}
    />
  );
}
