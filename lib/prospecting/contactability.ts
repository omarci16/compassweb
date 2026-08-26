// Contactability — can we actually reach this lead, and through what?
//
// This is the funnel stage Phase I exists to lift: a lead we cannot reach is
// worth nothing however well it scores. Kept pure and structural so the leads
// table, the prospecting dashboard and any query row can all use it.

import type { ContactSource, EmailStatus, SocialLinks } from "@/lib/types/app.types";

/** Best available channel, in the order we would actually try them. */
export type ReachChannel = "email" | "social" | "phone" | "none";

export interface ContactableLead {
  email: string | null;
  email_status: EmailStatus | null;
  phone: string | null;
  social_links: unknown;
  contact_source?: ContactSource | null;
}

function socialsOf(raw: unknown): SocialLinks {
  return raw && typeof raw === "object" ? (raw as SocialLinks) : {};
}

/**
 * Email first (it is what the send queue uses), then a social DM, then phone.
 * An `invalid` address is not a channel — it is a guaranteed bounce, and the
 * send queue refuses it, so the UI must not imply the lead is reachable.
 */
export function leadReachChannel(lead: ContactableLead): ReachChannel {
  if (lead.email && lead.email_status !== "invalid") return "email";
  const s = socialsOf(lead.social_links);
  if (s.instagram || s.facebook || s.linkedin) return "social";
  if (lead.phone) return "phone";
  return "none";
}

/** True when any outreach channel exists at all. */
export function isContactable(lead: ContactableLead): boolean {
  return leadReachChannel(lead) !== "none";
}

export interface ContactabilityStats {
  total: number;
  reachable: number;
  /** Share of leads with any channel, 0–100, rounded. */
  rate: number;
  by_email: number;
  by_social: number;
  by_phone: number;
  unreachable: number;
  /**
   * Emails that came from harvesting the site rather than Google Maps — the
   * honest scorecard for Phase I.
   */
  harvested_emails: number;
}

export function contactabilityStats(leads: ContactableLead[]): ContactabilityStats {
  const stats: ContactabilityStats = {
    total: leads.length,
    reachable: 0,
    rate: 0,
    by_email: 0,
    by_social: 0,
    by_phone: 0,
    unreachable: 0,
    harvested_emails: 0,
  };

  for (const lead of leads) {
    switch (leadReachChannel(lead)) {
      case "email":
        stats.by_email++;
        break;
      case "social":
        stats.by_social++;
        break;
      case "phone":
        stats.by_phone++;
        break;
      default:
        stats.unreachable++;
    }
    if (lead.contact_source === "website" && lead.email) stats.harvested_emails++;
  }

  stats.reachable = stats.by_email + stats.by_social + stats.by_phone;
  stats.rate = stats.total === 0 ? 0 : Math.round((stats.reachable / stats.total) * 100);
  return stats;
}
