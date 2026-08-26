import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Note: we intentionally do NOT pass a Database generic to the Supabase
// clients. The hand-rolled database.types.ts conflicts with supabase-js v2.x
// schema typing (resolves Schema → never). Until we generate types from a
// real Supabase project, queries are typed manually at the call site via
// `as Lead`, `as Project`, etc. — see lib/data/queries.ts.

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server component — set() called from middleware instead
          }
        },
      },
    },
  );
}

/**
 * Service-role client. NEVER expose this to the browser.
 * Used for privileged operations (webhooks, AI background jobs).
 * Bypasses RLS — handle with care.
 */
export function createServiceClient() {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
