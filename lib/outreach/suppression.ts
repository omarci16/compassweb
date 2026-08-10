// Suppression list access. Never send to a suppressed address (or domain), and
// auto-add on bounce/complaint/unsubscribe. Emails are stored lowercased so the
// exact-match checks are stable.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuppressionReason } from "@/lib/types/app.types";

function norm(email: string): string {
  return email.trim().toLowerCase();
}

function domainOf(email: string): string | null {
  const at = norm(email).lastIndexOf("@");
  return at > -1 ? norm(email).slice(at + 1) : null;
}

/** True if this email (or its domain) is on the suppression list. */
export async function isSuppressed(
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> {
  const e = norm(email);
  const d = domainOf(e);
  const or = d ? `email.eq.${e},domain.eq.${d}` : `email.eq.${e}`;
  const { data, error } = await supabase
    .from("suppression_list")
    .select("id")
    .or(or)
    .limit(1);
  if (error) {
    console.error("[suppression] check failed", error);
    // Fail safe: if we can't verify, treat as suppressed so we don't send.
    return true;
  }
  return (data ?? []).length > 0;
}

/** Add an address to the suppression list (idempotent on the email). */
export async function addSuppression(
  supabase: SupabaseClient,
  input: { email?: string | null; domain?: string | null; reason: SuppressionReason; notes?: string },
): Promise<void> {
  const email = input.email ? norm(input.email) : null;
  const { error } = await supabase.from("suppression_list").insert({
    email,
    domain: input.domain ? input.domain.trim().toLowerCase() : null,
    reason: input.reason,
    notes: input.notes ?? null,
  });
  // Unique-violation (already suppressed) is fine — swallow it.
  if (error && error.code !== "23505") {
    console.error("[suppression] add failed", error);
  }
}
