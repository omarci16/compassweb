import { describe, expect, it } from "vitest";
import { checkGate, suggestedWaitingOn } from "@/lib/utils/stage-gates";
import type { Project } from "@/lib/types/app.types";

const baseProject: Pick<
  Project,
  | "current_stage"
  | "contract_signed_at"
  | "materials_received_at"
  | "blueprint_data"
  | "blueprint_approved_at"
  | "revision_received_at"
  | "revision_deadline"
  | "final_payment_at"
> = {
  current_stage: 0,
  contract_signed_at: null,
  materials_received_at: null,
  blueprint_data: null,
  blueprint_approved_at: null,
  revision_received_at: null,
  revision_deadline: null,
  final_payment_at: null,
};

describe("checkGate", () => {
  it("blocks moving backwards", () => {
    const r = checkGate(
      { project: { ...baseProject, current_stage: 4 }, depositInvoice: null, finalInvoice: null },
      2,
    );
    expect(r.allowed).toBe(false);
  });

  it("blocks skipping stages", () => {
    const r = checkGate(
      { project: { ...baseProject, current_stage: 0 }, depositInvoice: null, finalInvoice: null },
      3,
    );
    expect(r.allowed).toBe(false);
  });

  it("allows 0→1 with no gate", () => {
    const r = checkGate(
      { project: { ...baseProject, current_stage: 0 }, depositInvoice: null, finalInvoice: null },
      1,
    );
    expect(r.allowed).toBe(true);
  });

  it("blocks 2→3 without contract or paid deposit", () => {
    const r = checkGate(
      { project: { ...baseProject, current_stage: 2 }, depositInvoice: { status: "draft" }, finalInvoice: null },
      3,
    );
    expect(r.allowed).toBe(false);
    expect(r.blockers).toContain("Contract not signed");
    expect(r.blockers).toContain("Deposit invoice not paid");
  });

  it("allows 2→3 when both conditions met", () => {
    const r = checkGate(
      {
        project: { ...baseProject, current_stage: 2, contract_signed_at: new Date().toISOString() },
        depositInvoice: { status: "paid" },
        finalInvoice: null,
      },
      3,
    );
    expect(r.allowed).toBe(true);
  });

  it("auto-approves 5→6 when revision deadline elapsed", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const r = checkGate(
      {
        project: {
          ...baseProject,
          current_stage: 5,
          revision_deadline: yesterday.toISOString(),
        },
        depositInvoice: null,
        finalInvoice: null,
      },
      6,
    );
    expect(r.allowed).toBe(true);
  });
});

describe("suggestedWaitingOn", () => {
  it("returns client for materials, revision, final-payment stages", () => {
    expect(suggestedWaitingOn(3)).toBe("client");
    expect(suggestedWaitingOn(5)).toBe("client");
    expect(suggestedWaitingOn(6)).toBe("client");
  });
  it("returns us for build, retainer, and pre-contract stages", () => {
    expect(suggestedWaitingOn(0)).toBe("us");
    expect(suggestedWaitingOn(4)).toBe("us");
    expect(suggestedWaitingOn(7)).toBe("us");
  });
});
