"use client";

import CrudTable from "@/components/CrudTable";

export default function IngredientsPage() {
  return (
    <CrudTable
      title="Ingredients"
      endpoint="/api/ingredients"
      columns={[
        { key: "name", label: "Name" },
        { key: "unit", label: "Unit" },
        { key: "costPerUnit", label: "Cost/Unit" },
        { key: "currentStock", label: "Current Stock" },
        {
          key: "reorderThreshold",
          label: "Status",
          render: (row) =>
            (row.currentStock as number) <= (row.reorderThreshold as number) ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Reorder</span>
            ) : (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
            ),
        },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "unit", label: "Unit (kg, litre...)", required: true },
        { key: "costPerUnit", label: "Cost per unit", type: "number", required: true },
        { key: "currentStock", label: "Current stock", type: "number" },
        { key: "reorderThreshold", label: "Reorder threshold", type: "number" },
      ]}
    />
  );
}
