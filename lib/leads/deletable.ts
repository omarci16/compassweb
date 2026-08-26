// Which leads are safe to delete in bulk.
//
// This exists because of what the foreign keys actually do (0001_initial_schema):
//
//   deals.lead_id                   ON DELETE CASCADE   ← deleting a lead DELETES its deal
//   re_engagement_sequences.lead_id ON DELETE CASCADE
//   outreach_drafts.lead_id         ON DELETE CASCADE
//   projects.lead_id                ON DELETE SET NULL  ← project survives, loses provenance
//   email_log.lead_id               ON DELETE SET NULL  ← row survives, loses its lead link
//   outreach_sends.lead_id          ON DELETE SET NULL
//
// So an unguarded bulk delete could silently destroy a live deal, or orphan the
// email history of a real customer. CLAUDE.md rule #4 keeps `email_log` rows
// append-only, and they do survive — but a log entry that no longer points at
// anyone is a materially worse record, so having emailed someone is treated as
// a reason to keep them.
//
// The purpose of bulk delete here is clearing scraped junk that never went
// anywhere. That is exactly the set this allows.

export interface LeadRefs {
  /** Rows in `deals` pointing at this lead (would be cascade-deleted). */
  deals: number;
  /** Rows in `projects` pointing at this lead (would lose provenance). */
  projects: number;
  /** Rows in `email_log` pointing at this lead (would be orphaned). */
  emails: number;
  /** Rows in `outreach_sends` — something was actually sent from the machine. */
  sends: number;
}

export const NO_REFS: LeadRefs = { deals: 0, projects: 0, emails: 0, sends: 0 };

export type DeleteVerdict =
  | { deletable: true }
  | { deletable: false; reason: string };

/**
 * Decide whether one lead may be hard-deleted.
 *
 * Order matters only for the message a human reads: report the most consequential
 * attachment first, so "van hozzá projekt" wins over "kaptak tőlünk emailt".
 */
export function classifyDeletable(refs: LeadRefs): DeleteVerdict {
  if (refs.projects > 0) {
    return { deletable: false, reason: "Van hozzá futó projekt" };
  }
  if (refs.deals > 0) {
    return { deletable: false, reason: "Van hozzá deal a pipeline-ban" };
  }
  if (refs.emails > 0 || refs.sends > 0) {
    return { deletable: false, reason: "Már küldtünk neki emailt" };
  }
  return { deletable: true };
}

export interface PartitionInput {
  id: string;
  company_name: string;
  refs: LeadRefs;
}

export interface Blocked {
  id: string;
  company_name: string;
  reason: string;
}

/** Split a requested batch into what will actually be deleted and what is kept. */
export function partitionDeletable(items: PartitionInput[]): {
  deletable: string[];
  blocked: Blocked[];
} {
  const deletable: string[] = [];
  const blocked: Blocked[] = [];

  for (const item of items) {
    const verdict = classifyDeletable(item.refs);
    if (verdict.deletable) {
      deletable.push(item.id);
    } else {
      blocked.push({
        id: item.id,
        company_name: item.company_name,
        reason: verdict.reason,
      });
    }
  }

  return { deletable, blocked };
}

/** Human summary for the toast after a bulk delete. */
export function summarizeDeletion(deleted: number, blocked: number): string {
  if (deleted === 0 && blocked === 0) return "Nem volt mit törölni.";
  if (blocked === 0) return `${deleted} lead törölve.`;
  if (deleted === 0) return `Egyik lead sem törölhető (${blocked} megtartva).`;
  return `${deleted} lead törölve, ${blocked} megtartva.`;
}
