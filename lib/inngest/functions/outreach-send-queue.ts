// Send queue (Scraping 2.1, Phase E). Pulls HUMAN-APPROVED drafts and sends
// them, one at a time, from a rotated inbox that is under its (warmup-aware)
// daily cap, with 3–7 min randomized spacing. Writes the immutable record to
// email_log (append-only) and the mutable lifecycle row to outreach_sends.
//
// Guarantees: never sends a draft that isn't status='approved'; never sends to a
// suppressed or email_status='invalid' address; concurrency 1 so caps hold.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail, FROM_EMAIL } from "@/lib/resend/client";
import { renderColdOutreachHtml } from "@/lib/resend/templates";
import { makeUnsubToken } from "@/lib/outreach/unsubscribe-token";
import { isSuppressed } from "@/lib/outreach/suppression";
import {
  parseInboxesFromEnv,
  pickInbox,
  randomSpacingSeconds,
} from "@/lib/outreach/inbox-rotation";
import type { SendingInbox } from "@/lib/types/app.types";

const PER_RUN = 6; // drafts per invocation; re-emits to continue if more remain

interface ApprovedDraft {
  id: string;
  lead_id: string;
  subject: string;
  body_html: string;
  body_text: string;
  visual_urls: unknown;
  track: string;
}

interface DraftLead {
  id: string;
  email: string | null;
  email_status: string | null;
  company_name: string;
}

export const outreachSendQueue = inngest.createFunction(
  // retries 0: a send that half-succeeds must not be retried into a double-send.
  { id: "outreach-send-queue", concurrency: 1, retries: 0 },
  [
    { event: "outreach/send-queue" },
    // Drains the queue on a schedule too (business hours, Budapest).
    { cron: "TZ=Europe/Budapest */20 9-18 * * 1-5" },
  ],
  async ({ step }) => {
    const supabase = createServiceClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.PORTAL_BASE_URL || "";

    // ----- Inboxes: table first, env fallback, single-address last resort -----
    const inboxes = await step.run("load-inboxes", async (): Promise<SendingInbox[]> => {
      const { data } = await supabase
        .from("sending_inboxes")
        .select("id, created_at, updated_at, address, from_name, daily_cap, warmup_started_at, active")
        .eq("active", true);
      let list = (data ?? []) as unknown as SendingInbox[];
      if (list.length === 0) {
        list = parseInboxesFromEnv(
          process.env.SENDING_INBOXES,
          Number(process.env.SENDING_DAILY_CAP) || 30,
        );
      }
      if (list.length === 0) {
        list = [
          {
            id: "default",
            created_at: new Date(0).toISOString(),
            updated_at: new Date(0).toISOString(),
            address: FROM_EMAIL,
            from_name: null,
            daily_cap: Number(process.env.SENDING_DAILY_CAP) || 30,
            warmup_started_at: null,
            active: true,
          },
        ];
      }
      return list;
    });

    // ----- Today's send counts per inbox (for cap enforcement) -----
    const sentToday = await step.run("sent-today", async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("outreach_sends")
        .select("inbox")
        .gte("sent_at", start.toISOString());
      const counts: Record<string, number> = {};
      for (const r of (data ?? []) as { inbox: string | null }[]) {
        if (r.inbox) counts[r.inbox] = (counts[r.inbox] ?? 0) + 1;
      }
      return counts;
    });

    // ----- Approved drafts (oldest first) + their leads -----
    const drafts = await step.run("approved-drafts", async () => {
      const { data } = await supabase
        .from("outreach_drafts")
        .select("id, lead_id, subject, body_html, body_text, visual_urls, track")
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .limit(PER_RUN + 1);
      return (data ?? []) as unknown as ApprovedDraft[];
    });

    if (drafts.length === 0) return { ok: true, sent: 0, reason: "queue empty" };

    const leadMap = await step.run("draft-leads", async () => {
      const ids = Array.from(new Set(drafts.map((d) => d.lead_id)));
      const { data } = await supabase
        .from("leads")
        .select("id, email, email_status, company_name")
        .in("id", ids);
      const map: Record<string, DraftLead> = {};
      for (const l of (data ?? []) as DraftLead[]) map[l.id] = l;
      return map;
    });

    const sentLocal = { ...sentToday };
    let sent = 0;

    for (let i = 0; i < Math.min(drafts.length, PER_RUN); i++) {
      const draft = drafts[i];
      const inbox = pickInbox(inboxes, sentLocal);
      if (!inbox) break; // all inboxes at cap — leave the rest for the next run

      const result = await step.run(`send-${draft.id}`, async () => {
        const lead = leadMap[draft.lead_id];
        const email = lead?.email ?? null;

        // Gate: valid email required.
        if (!email || lead?.email_status === "invalid") {
          await supabase.from("outreach_drafts").update({ status: "skipped" }).eq("id", draft.id);
          return { outcome: "skipped" as const };
        }
        // Gate: suppression.
        if (await isSuppressed(supabase, email)) {
          await supabase.from("outreach_drafts").update({ status: "skipped" }).eq("id", draft.id);
          return { outcome: "skipped" as const };
        }

        const visualUrls = Array.isArray(draft.visual_urls)
          ? (draft.visual_urls as string[])
          : [];
        const unsubscribeUrl = `${appUrl}/api/unsubscribe/${makeUnsubToken(email)}`;
        const html = renderColdOutreachHtml({
          bodyHtml: draft.body_html,
          visualUrls,
          visualAlt: `${lead.company_name} — koncepció`,
          unsubscribeUrl,
        });
        const from = inbox.from_name ? `${inbox.from_name} <${inbox.address}>` : inbox.address;

        try {
          const res = await sendEmail({
            to: email,
            subject: draft.subject,
            html,
            text: draft.body_text,
            from,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });
          const messageId = res.data?.id ?? null;
          const nowIso = new Date().toISOString();

          // Immutable record (append-only) — CLAUDE.md rule #4.
          await supabase.from("email_log").insert({
            lead_id: draft.lead_id,
            direction: "outbound",
            from_address: inbox.address,
            to_address: email,
            subject: draft.subject,
            body_html: html,
            body_text: draft.body_text,
            sent_at: nowIso,
            resend_message_id: messageId,
            type: "cold_outreach",
            ai_drafted: true,
          });
          // Mutable lifecycle row.
          await supabase.from("outreach_sends").insert({
            draft_id: draft.id,
            lead_id: draft.lead_id,
            inbox: inbox.address,
            resend_message_id: messageId,
            status: "sent",
            to_address: email,
            sent_at: nowIso,
          });
          await supabase.from("outreach_drafts").update({ status: "sent" }).eq("id", draft.id);
          await supabase
            .from("leads")
            .update({ first_contact_at: nowIso })
            .eq("id", draft.lead_id)
            .is("first_contact_at", null);

          return { outcome: "sent" as const, inbox: inbox.address };
        } catch (err) {
          console.error("[send-queue] send failed", err);
          await supabase.from("outreach_sends").insert({
            draft_id: draft.id,
            lead_id: draft.lead_id,
            inbox: inbox.address,
            status: "failed",
            to_address: email,
            error_message: err instanceof Error ? err.message : "send failed",
          });
          // Kick back to review so it doesn't loop forever in the queue.
          await supabase.from("outreach_drafts").update({ status: "draft" }).eq("id", draft.id);
          return { outcome: "failed" as const };
        }
      });

      if (result.outcome === "sent") {
        sentLocal[inbox.address] = (sentLocal[inbox.address] ?? 0) + 1;
        sent += 1;
        // Randomized spacing before the next send (skip after the last one).
        if (i < Math.min(drafts.length, PER_RUN) - 1) {
          await step.sleep(`space-${draft.id}`, `${randomSpacingSeconds()}s`);
        }
      }
    }

    // More approved drafts than we processed + we made progress → continue.
    if (drafts.length > PER_RUN && sent > 0) {
      await step.sendEvent("continue", { name: "outreach/send-queue", data: {} });
    }

    return { ok: true, sent };
  },
);
