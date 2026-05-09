// Urgency scoring — recalculated whenever a deal/project changes and nightly via Inngest.
//
// Deal urgency answers: "how urgently must WE act on this deal RIGHT NOW?"
// Project urgency answers: "which active project most needs our attention?"
//
// Scores are clamped 0–100. Higher = more urgent.

import { differenceInDays } from "date-fns";
import { clamp } from "@/lib/utils/format";

// ---------------------------------------------------------------------
// Deal urgency
// ---------------------------------------------------------------------

export interface DealUrgencyInput {
  last_client_contact_at: string | Date | null;
  followup_count: number;
  proposal_sent_at: string | Date | null;
  vercel_preview_attached_at: string | Date | null;
  vercel_preview_sent: boolean;
  days_in_current_stage: number;
  win_probability: number | null;
  any_action_taken: boolean;
}

export interface UrgencyBreakdown {
  score: number;
  factors: { label: string; delta: number }[];
}

export function computeDealUrgency(input: DealUrgencyInput): UrgencyBreakdown {
  const factors: { label: string; delta: number }[] = [];
  const now = new Date();

  if (input.last_client_contact_at) {
    const days = differenceInDays(now, new Date(input.last_client_contact_at));
    if (days >= 5) factors.push({ label: "5+ days since client contact", delta: 30 });
    else if (days >= 3) factors.push({ label: "3+ days since client contact", delta: 15 });
  }

  if (input.proposal_sent_at && input.followup_count === 0) {
    factors.push({ label: "Proposal sent, no follow-up yet", delta: 20 });
  }

  if (input.vercel_preview_attached_at && !input.vercel_preview_sent) {
    const days = differenceInDays(now, new Date(input.vercel_preview_attached_at));
    if (days > 2) factors.push({ label: "Visual ready but not sent (2+ days)", delta: 25 });
  }

  if (input.days_in_current_stage >= 7)
    factors.push({ label: "Stage stalled 7+ days", delta: 20 });

  if ((input.win_probability ?? 0) > 70 && !input.any_action_taken)
    factors.push({ label: "High-probability lead, no action", delta: 15 });

  const total = factors.reduce((s, f) => s + f.delta, 0);
  return { score: clamp(total, 0, 100), factors };
}

// ---------------------------------------------------------------------
// Project urgency
// ---------------------------------------------------------------------

export interface ProjectUrgencyInput {
  current_stage: number;
  days_in_current_stage: number;
  waiting_on: "us" | "client";
  blocker: string | null;
  materials_deadline: string | Date | null;
  revision_deadline: string | Date | null;
  has_overdue_invoice: boolean;
  final_payment_received: boolean;
}

export function computeProjectUrgency(input: ProjectUrgencyInput): UrgencyBreakdown {
  const factors: { label: string; delta: number }[] = [];
  const now = new Date();

  if (input.waiting_on === "us") {
    if (input.days_in_current_stage > 7)
      factors.push({ label: "Waiting on us 7+ days", delta: 60 });
    else if (input.days_in_current_stage > 3)
      factors.push({ label: "Waiting on us 3+ days", delta: 40 });
  }

  const deadlineUrgency = (deadline: string | Date | null, label: string) => {
    if (!deadline) return;
    const days = differenceInDays(new Date(deadline), now);
    if (days <= 0) factors.push({ label: `${label} past due`, delta: 50 });
    else if (days < 2) factors.push({ label: `${label} < 2 days`, delta: 45 });
  };
  deadlineUrgency(input.materials_deadline, "Materials deadline");
  deadlineUrgency(input.revision_deadline, "Revision deadline");

  if (input.blocker) factors.push({ label: "Blocker set", delta: 20 });
  if (input.has_overdue_invoice) factors.push({ label: "Invoice overdue", delta: 30 });

  if (input.current_stage === 6 && !input.final_payment_received)
    factors.push({ label: "Awaiting final payment", delta: 35 });

  const total = factors.reduce((s, f) => s + f.delta, 0);
  return { score: clamp(total, 0, 100), factors };
}
