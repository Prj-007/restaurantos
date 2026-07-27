import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Sidebar role={session.role} />
      <div className="flex flex-1 flex-col">
        <Topbar name={session.name} role={session.role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
