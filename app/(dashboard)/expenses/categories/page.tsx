"use client";

import CrudTable from "@/components/CrudTable";

export default function ExpenseCategoriesPage() {
  return (
    <CrudTable
      title="Expense Categories"
      endpoint="/api/expense-categories"
      columns={[
        { key: "name", label: "Name" },
        { key: "description", label: "Description" },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "description", label: "Description" },
      ]}
    />
  );
}
