import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { initialsOf } from "@/lib/utils/format";
import { isSupabaseConfigured } from "@/lib/data/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initials = "RB";

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    initials = initialsOf(user.user_metadata?.full_name || user.email || "");
  }
  // In demo mode (no Supabase env), no auth — the dashboard renders directly.

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar initials={initials} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
