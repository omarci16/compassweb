"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/erp";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  // Mirrors the .gate card in admin.css so the two internal tools open the
  // same way: centred card on the near-black ground, logo, mono eyebrow.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-card p-8 sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/logo.png"
          alt="Compass Systems"
          className="mb-8 h-6 w-auto"
        />

        <span className="mono-label">[ Belső eszköz — ERP ]</span>
        <h1 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-foreground">
          Vezérlőpult
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Jelentkezz be a folytatáshoz. Csak meghívott felhasználók férnek hozzá.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="mono-label">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="username"
              placeholder="nev@compassmarketing.hu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="mono-label">
              Jelszó
            </Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Belépés →
          </Button>
        </form>

        <p className="mono-label mt-8 border-t border-border pt-5 !text-[10px]">
          Compass Marketing Kft. · Csak belső használatra
        </p>
      </div>
    </div>
  );
}
