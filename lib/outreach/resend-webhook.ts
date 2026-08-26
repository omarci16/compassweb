// Pure helpers for the Resend webhook: signature verification (Svix scheme),
// event→status mapping, and a monotonic status transition so a late "delivered"
// can't clobber an "opened". Unit-tested directly; the route stays thin.

import crypto from "node:crypto";
import type { OutreachSendStatus, SuppressionReason } from "@/lib/types/app.types";

// Non-terminal lifecycle order — later beats earlier.
const RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
};
const TERMINAL = new Set(["bounced", "complained", "unsubscribed", "failed"]);

/**
 * The status a send should hold after an incoming event: terminal states stick;
 * otherwise only advance forward so out-of-order opens/delivers don't regress.
 */
export function nextSendStatus(
  current: OutreachSendStatus,
  incoming: OutreachSendStatus,
): OutreachSendStatus {
  if (TERMINAL.has(current)) return current;
  if (TERMINAL.has(incoming)) return incoming;
  const c = RANK[current] ?? 0;
  const n = RANK[incoming] ?? 0;
  return n > c ? incoming : current;
}

export interface ResendEventMap {
  status: OutreachSendStatus;
  tsField: "sent_at" | "opened_at" | "clicked_at" | "bounced_at" | "complained_at" | null;
  suppress: SuppressionReason | null;
}

/** Map a Resend event type to our lifecycle. Returns null for events we ignore. */
export function mapResendEvent(type: string): ResendEventMap | null {
  switch (type) {
    case "email.sent":
      return { status: "sent", tsField: "sent_at", suppress: null };
    case "email.delivered":
      return { status: "delivered", tsField: null, suppress: null };
    case "email.opened":
      return { status: "opened", tsField: "opened_at", suppress: null };
    case "email.clicked":
      return { status: "clicked", tsField: "clicked_at", suppress: null };
    case "email.bounced":
      return { status: "bounced", tsField: "bounced_at", suppress: "bounce" };
    case "email.complained":
      return { status: "complained", tsField: "complained_at", suppress: "complaint" };
    default:
      return null;
  }
}

/**
 * Verify a Resend (Svix) webhook signature. Returns true only if one of the
 * signatures in `svix-signature` matches. Pure given its inputs.
 */
export function verifyResendSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");
    // Header is space-separated "v1,<sig> v1,<sig>"; compare the base64 part.
    const provided = headers.signature.split(" ").map((p) => p.split(",")[1] ?? p);
    return provided.some((sig) => timingEqual(sig, expected));
  } catch {
    return false;
  }
}

function timingEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
