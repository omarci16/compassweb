import { randomBytes } from "crypto";

export function generatePortalToken(): string {
  return randomBytes(32).toString("hex");
}

export function isValidPortalToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
