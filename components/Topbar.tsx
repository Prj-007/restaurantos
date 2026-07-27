"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import ThemeToggle from "@/components/ThemeToggle";

export default function Topbar({ name, role }: { name: string; role: Role }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-3">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{name}</p>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{role}</p>
        </div>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
