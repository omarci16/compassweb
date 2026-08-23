import { describe, expect, it } from "vitest";
import {
  NO_REFS,
  classifyDeletable,
  partitionDeletable,
  summarizeDeletion,
  type LeadRefs,
} from "@/lib/leads/deletable";

const refs = (over: Partial<LeadRefs> = {}): LeadRefs => ({ ...NO_REFS, ...over });

describe("classifyDeletable", () => {
  it("allows a lead nothing points at — the scraped-junk case", () => {
    expect(classifyDeletable(NO_REFS)).toEqual({ deletable: true });
  });

  it("blocks a lead with a deal, because the FK would cascade-delete it", () => {
    const v = classifyDeletable(refs({ deals: 1 }));
    expect(v.deletable).toBe(false);
    expect(v).toHaveProperty("reason");
  });

  it("blocks a lead with a project", () => {
    expect(classifyDeletable(refs({ projects: 1 })).deletable).toBe(false);
  });

  it("blocks a lead we have emailed, so the log keeps its subject", () => {
    expect(classifyDeletable(refs({ emails: 1 })).deletable).toBe(false);
    expect(classifyDeletable(refs({ sends: 1 })).deletable).toBe(false);
  });

  it("reports the most consequential attachment first", () => {
    const v = classifyDeletable(refs({ projects: 1, deals: 1, emails: 5 }));
    expect(v).toEqual({ deletable: false, reason: "Van hozzá futó projekt" });

    const d = classifyDeletable(refs({ deals: 1, emails: 5 }));
    expect(d).toEqual({ deletable: false, reason: "Van hozzá deal a pipeline-ban" });
  });
});

describe("partitionDeletable", () => {
  it("splits a batch and keeps the blocked ones identifiable", () => {
    const { deletable, blocked } = partitionDeletable([
      { id: "a", company_name: "Junk Kft", refs: NO_REFS },
      { id: "b", company_name: "Valódi Ügyfél", refs: refs({ projects: 1 }) },
      { id: "c", company_name: "Másik Junk", refs: NO_REFS },
      { id: "d", company_name: "Megkeresett", refs: refs({ emails: 2 }) },
    ]);

    expect(deletable).toEqual(["a", "c"]);
    expect(blocked).toHaveLength(2);
    expect(blocked[0]).toMatchObject({ id: "b", company_name: "Valódi Ügyfél" });
    expect(blocked[1].reason).toBe("Már küldtünk neki emailt");
  });

  it("handles an empty batch", () => {
    expect(partitionDeletable([])).toEqual({ deletable: [], blocked: [] });
  });

  it("blocks everything when nothing is safe", () => {
    const { deletable, blocked } = partitionDeletable([
      { id: "a", company_name: "X", refs: refs({ deals: 1 }) },
    ]);
    expect(deletable).toEqual([]);
    expect(blocked).toHaveLength(1);
  });
});

describe("summarizeDeletion", () => {
  it("describes each outcome plainly", () => {
    expect(summarizeDeletion(3, 0)).toBe("3 lead törölve.");
    expect(summarizeDeletion(0, 2)).toBe("Egyik lead sem törölhető (2 megtartva).");
    expect(summarizeDeletion(3, 2)).toBe("3 lead törölve, 2 megtartva.");
    expect(summarizeDeletion(0, 0)).toBe("Nem volt mit törölni.");
  });
});
