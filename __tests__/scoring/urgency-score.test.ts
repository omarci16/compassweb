import { describe, expect, it } from "vitest";
import {
  computeDealUrgency,
  computeProjectUrgency,
} from "@/lib/ai/scoring/urgency-score";

describe("computeDealUrgency", () => {
  it("returns 0 with no signals", () => {
    const r = computeDealUrgency({
      last_client_contact_at: null,
      followup_count: 0,
      proposal_sent_at: null,
      vercel_preview_attached_at: null,
      vercel_preview_sent: false,
      days_in_current_stage: 0,
      win_probability: null,
      any_action_taken: true,
    });
    expect(r.score).toBe(0);
  });

  it("adds 30 for 5+ days no contact", () => {
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    const r = computeDealUrgency({
      last_client_contact_at: sixDaysAgo,
      followup_count: 0,
      proposal_sent_at: null,
      vercel_preview_attached_at: null,
      vercel_preview_sent: false,
      days_in_current_stage: 0,
      win_probability: null,
      any_action_taken: true,
    });
    expect(r.score).toBe(30);
  });

  it("flags stalled visual not sent", () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const r = computeDealUrgency({
      last_client_contact_at: null,
      followup_count: 0,
      proposal_sent_at: null,
      vercel_preview_attached_at: fiveDaysAgo,
      vercel_preview_sent: false,
      days_in_current_stage: 0,
      win_probability: null,
      any_action_taken: true,
    });
    expect(r.score).toBe(25);
  });

  it("clamps at 100", () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 30);
    const r = computeDealUrgency({
      last_client_contact_at: longAgo,
      followup_count: 0,
      proposal_sent_at: longAgo,
      vercel_preview_attached_at: longAgo,
      vercel_preview_sent: false,
      days_in_current_stage: 14,
      win_probability: 90,
      any_action_taken: false,
    });
    expect(r.score).toBe(100);
  });
});

describe("computeProjectUrgency", () => {
  it("flags us-waiting > 7 days as +60", () => {
    const r = computeProjectUrgency({
      current_stage: 4,
      days_in_current_stage: 8,
      waiting_on: "us",
      blocker: null,
      materials_deadline: null,
      revision_deadline: null,
      has_overdue_invoice: false,
      final_payment_received: true,
    });
    expect(r.score).toBe(60);
  });

  it("flags overdue materials deadline", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const r = computeProjectUrgency({
      current_stage: 3,
      days_in_current_stage: 1,
      waiting_on: "client",
      blocker: null,
      materials_deadline: yesterday,
      revision_deadline: null,
      has_overdue_invoice: false,
      final_payment_received: true,
    });
    expect(r.score).toBe(50);
  });

  it("compounds blocker + overdue invoice + stage 6 unpaid", () => {
    const r = computeProjectUrgency({
      current_stage: 6,
      days_in_current_stage: 2,
      waiting_on: "client",
      blocker: "Waiting for final approval email",
      materials_deadline: null,
      revision_deadline: null,
      has_overdue_invoice: true,
      final_payment_received: false,
    });
    expect(r.score).toBe(85); // 20 + 30 + 35
  });
});
