import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/utils/format";
import { LogOut } from "lucide-react";
import { signOut } from "./actions";
import { isSupabaseConfigured } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let email = "demo@compassmarketing.hu";
  let name = "Demo User";
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? "";
    name = user?.user_metadata?.full_name || email;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Account and integrations.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Profile</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarFallback>{initialsOf(name)}</AvatarFallback></Avatar>
            <div>
              <div className="font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
          </div>
          <form action={signOut}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Integrations</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { name: "Supabase", env: "NEXT_PUBLIC_SUPABASE_URL", role: "Database, auth, storage" },
            { name: "Anthropic", env: "ANTHROPIC_API_KEY", role: "All AI drafting and scoring" },
            { name: "Apify", env: "APIFY_API_TOKEN", role: "Lead enrichment" },
            { name: "Resend", env: "RESEND_API_KEY", role: "Outbound email" },
            { name: "Inngest", env: "INNGEST_EVENT_KEY", role: "Background jobs" },
          ].map((i) => (
            <div key={i.name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
              <div>
                <div className="font-medium">{i.name}</div>
                <div className="text-[11px] text-muted-foreground">{i.role}</div>
              </div>
              <code className="text-[10px] text-muted-foreground font-mono">{i.env}</code>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
