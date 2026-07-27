"use client";

import CrudTable from "@/components/CrudTable";

export default function StaffPage() {
  return (
    <CrudTable
      title="Staff Management"
      endpoint="/api/staff"
      columns={[
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "phone", label: "Phone" },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        {
          key: "role",
          label: "Role",
          type: "select",
          required: true,
          options: ["OWNER", "MANAGER", "CHEF", "WAITER", "CASHIER"].map((r) => ({ value: r, label: r })),
        },
        { key: "phone", label: "Phone" },
      ]}
    />
  );
}
