import { describe, expect, it } from "vitest";
import {
  classifyEmail,
  deriveEmailStatus,
  verifyEmail,
  verifyManyEmails,
} from "@/lib/prospecting/email-verify";

describe("classifyEmail (pure)", () => {
  it("accepts a normal address and lowercases it", () => {
    const c = classifyEmail("Anna@KovacsDental.hu");
    expect(c.syntax_ok).toBe(true);
    expect(c.email).toBe("anna@kovacsdental.hu");
    expect(c.domain).toBe("kovacsdental.hu");
    expect(c.local_part).toBe("anna");
    expect(c.disposable).toBe(false);
    expect(c.role_account).toBe(false);
  });

  it("rejects malformed syntax", () => {
    for (const bad of ["", "  ", "no-at-sign", "a@b", "a@@b.hu", "a b@c.hu", "@nodomain.hu"]) {
      expect(classifyEmail(bad).syntax_ok).toBe(false);
    }
  });

  it("flags disposable domains", () => {
    expect(classifyEmail("someone@mailinator.com").disposable).toBe(true);
    expect(classifyEmail("x@guerrillamail.com").disposable).toBe(true);
    expect(classifyEmail("x@gmail.com").disposable).toBe(false);
  });

  it("flags role accounts, including Hungarian ones", () => {
    expect(classifyEmail("info@ex.hu").role_account).toBe(true);
    expect(classifyEmail("office@ex.hu").role_account).toBe(true);
    expect(classifyEmail("kapcsolat@ex.hu").role_account).toBe(true);
    expect(classifyEmail("rendeles@ex.hu").role_account).toBe(true);
    expect(classifyEmail("gabor.nagy@ex.hu").role_account).toBe(false);
  });
});

describe("deriveEmailStatus (pure)", () => {
  const person = classifyEmail("gabor@ex.hu");
  const role = classifyEmail("info@ex.hu");
  const disposable = classifyEmail("x@mailinator.com");
  const bad = classifyEmail("nope");

  it("valid: clean personal address with MX", () => {
    expect(deriveEmailStatus(person, true)).toBe("valid");
  });
  it("risky: role account even with MX", () => {
    expect(deriveEmailStatus(role, true)).toBe("risky");
  });
  it("risky: MX unverifiable (null) for a personal address", () => {
    expect(deriveEmailStatus(person, null)).toBe("risky");
  });
  it("invalid: bad syntax, disposable, or no mail server", () => {
    expect(deriveEmailStatus(bad, true)).toBe("invalid");
    expect(deriveEmailStatus(disposable, true)).toBe("invalid");
    expect(deriveEmailStatus(person, false)).toBe("invalid");
  });
});

describe("verifyEmail (MX injected)", () => {
  const mxYes = async () => true as const;
  const mxNo = async () => false as const;

  it("unknown when there is no email", async () => {
    const r = await verifyEmail(null, mxYes);
    expect(r.email_status).toBe("unknown");
  });

  it("valid for a personal address whose domain has MX", async () => {
    const r = await verifyEmail("gabor.nagy@kovacsdental.hu", mxYes);
    expect(r.email_status).toBe("valid");
    expect(r.has_mx).toBe(true);
  });

  it("invalid for a domain with no mail server", async () => {
    const r = await verifyEmail("gabor@nowhere.hu", mxNo);
    expect(r.email_status).toBe("invalid");
  });

  it("never calls MX for bad syntax", async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return true as const;
    };
    const r = await verifyEmail("not-an-email", spy);
    expect(r.email_status).toBe("invalid");
    expect(called).toBe(false);
  });
});

describe("verifyManyEmails", () => {
  it("preserves order across the input", async () => {
    // Uses the real hasMx via verifyEmail — but all inputs are bad-syntax /
    // empty so no DNS is hit; results are deterministic and order-stable.
    const r = await verifyManyEmails(["bad", null, "also-bad"], 2);
    expect(r).toHaveLength(3);
    expect(r[0].email_status).toBe("invalid");
    expect(r[1].email_status).toBe("unknown");
    expect(r[2].email_status).toBe("invalid");
  });
});
