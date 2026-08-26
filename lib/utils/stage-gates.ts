// Stage gate validation. Mirrors business contract:
//   0 → 1: manual (post-discovery)
//   1 → 2: manual (post-call)
//   2 → 3: contract signed AND deposit invoice paid
//   3 → 4: materials_received_at set
//   4 → 5: blueprint approved
//   5 → 6: revision received OR auto-approve elapsed
//   6 → 7: final invoice paid
//   7 → end: terminal
//
// Enforced both at the API and in the UI. Never bypass.

import type { Project, Invoice, ProjectStage } from "@/lib/types/app.types";

export interface GateResult {
  allowed: boolean;
  blockers: string[];
}

export interface GateContext {
  project: Pick<
    Project,
    | "current_stage"
    | "contract_signed_at"
    | "materials_received_at"
    | "blueprint_data"
    | "blueprint_approved_at"
    | "revision_received_at"
    | "revision_deadline"
    | "final_payment_at"
  >;
  depositInvoice: Pick<Invoice, "status"> | null;
  finalInvoice: Pick<Invoice, "status"> | null;
}

export function checkGate(
  ctx: GateContext,
  targetStage: ProjectStage,
): GateResult {
  const blockers: string[] = [];
  const { project } = ctx;
  const from = project.current_stage as ProjectStage;

  if (targetStage <= from) {
    return { allowed: false, blockers: ["Cannot move backwards"] };
  }
  if (targetStage !== ((from + 1) as ProjectStage)) {
    return { allowed: false, blockers: ["Stages must advance one at a time"] };
  }

  switch (targetStage) {
    case 1:
    case 2:
      // Manual transitions, no gate
      break;

    case 3:
      if (!project.contract_signed_at) blockers.push("Contract not signed");
      if (ctx.depositInvoice?.status !== "paid")
        blockers.push("Deposit invoice not paid");
      break;

    case 4:
      if (!project.materials_received_at)
        blockers.push("Materials not received");
      break;

    case 5:
      if (!project.blueprint_data) blockers.push("Blueprint not generated");
      if (!project.blueprint_approved_at) blockers.push("Blueprint not approved");
      break;

    case 6: {
      // Either client confirmed revisions OR auto-approve deadline elapsed
      const hasRevision = !!project.revision_received_at;
      const autoApproved =
        project.revision_deadline &&
        new Date(project.revision_deadline) < new Date();
      if (!hasRevision && !autoApproved) {
        blockers.push("Revision not received and auto-approve deadline not yet reached");
      }
      break;
    }

    case 7:
      if (!project.final_payment_at && ctx.finalInvoice?.status !== "paid")
        blockers.push("Final invoice not paid");
      break;
  }

  return { allowed: blockers.length === 0, blockers };
}

/** Suggest the correct waiting_on value when entering a given stage. */
export function suggestedWaitingOn(stage: ProjectStage): "us" | "client" {
  switch (stage) {
    case 0:
    case 1:
    case 2:
    case 4:
    case 7:
      return "us";
    case 3:
    case 5:
    case 6:
      return "client";
  }
}
