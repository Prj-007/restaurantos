"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ApproveButton({ invoiceId, status }: { invoiceId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    setLoading(false);
    router.refresh();
  }

  if (status === "APPROVED") {
    return <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">Approved</span>;
  }

  return (
    <button onClick={handleApprove} disabled={loading} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
      {loading ? "..." : "Approve"}
    </button>
  );
}
