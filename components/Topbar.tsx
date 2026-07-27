"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

export default function Topbar({ name, role }: { name: string; role: Role }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-900">{name}</p>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
