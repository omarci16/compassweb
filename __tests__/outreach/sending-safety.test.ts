import { describe, expect, it } from "vitest";
import { makeUnsubToken, verifyUnsubToken } from "@/lib/outreach/unsubscribe-token";
import {
  mapResendEvent,
  nextSendStatus,
  verifyResendSignature,
} from "@/lib/outreach/resend-webhook";
import crypto from "node:crypto";

describe("unsubscribe token", () => {
  it("round-trips an email (case-insensitive)", () => {
    const t = makeUnsubToken("Anna@Example.hu");
    expect(verifyUnsubToken(t)).toBe("anna@example.hu");
  });

  it("rejects tampered or malformed tokens", () => {
    const t = makeUnsubToken("x@y.hu");
    expect(verifyUnsubToken(t + "z")).toBeNull();
    expect(verifyUnsubToken("garbage")).toBeNull();
    expect(verifyUnsubToken("")).toBeNull();
    const [payload] = t.split(".");
    expect(verifyUnsubToken(`${payload}.wrongsig`)).toBeNull();
  });
});

describe("nextSendStatus", () => {
  it("advances forward but never regresses", () => {
    expect(nextSendStatus("sent", "delivered")).toBe("delivered");
    expect(nextSendStatus("opened", "delivered")).toBe("opened"); // no regress
    expect(nextSendStatus("delivered", "clicked")).toBe("clicked");
  });

  it("terminal states stick; incoming terminal overrides non-terminal", () => {
    expect(nextSendStatus("bounced", "opened")).toBe("bounced");
    expect(nextSendStatus("opened", "bounced")).toBe("bounced");
    expect(nextSendStatus("complained", "clicked")).toBe("complained");
  });
});

describe("mapResendEvent", () => {
  it("maps known events, suppressing on bounce/complaint", () => {
    expect(mapResendEvent("email.opened")).toMatchObject({ status: "opened", tsField: "opened_at", suppress: null });
    expect(mapResendEvent("email.bounced")).toMatchObject({ status: "bounced", suppress: "bounce" });
    expect(mapResendEvent("email.complained")).toMatchObject({ status: "complained", suppress: "complaint" });
  });
  it("ignores unknown events", () => {
    expect(mapResendEvent("email.delivery_delayed")).toBeNull();
    expect(mapResendEvent("nonsense")).toBeNull();
  });
});

describe("verifyResendSignature", () => {
  const secret = "whsec_" + Buffer.from("supersecretkeymaterial").toString("base64");
  const id = "msg_123";
  const timestamp = "1700000000";
  const body = JSON.stringify({ type: "email.opened", data: { email_id: "e1" } });

  function sign(): string {
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const sig = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
    return `v1,${sig}`;
  }

  it("accepts a correct signature", () => {
    expect(
      verifyResendSignature(secret, { id, timestamp, signature: sign() }, body),
    ).toBe(true);
  });

  it("rejects a wrong signature, missing headers, or tampered body", () => {
    expect(verifyResendSignature(secret, { id, timestamp, signature: "v1,bad" }, body)).toBe(false);
    expect(verifyResendSignature(secret, { id: null, timestamp, signature: sign() }, body)).toBe(false);
    expect(verifyResendSignature(secret, { id, timestamp, signature: sign() }, body + "x")).toBe(false);
    expect(verifyResendSignature("", { id, timestamp, signature: sign() }, body)).toBe(false);
  });
});
