import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "info@compassmarketing.hu";

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /** Override sender for inbox rotation (Scraping 2.1). Defaults to FROM_EMAIL. */
  from?: string;
  /** Extra headers, e.g. List-Unsubscribe / List-Unsubscribe-Post (RFC 8058). */
  headers?: Record<string, string>;
}

export async function sendEmail(input: SendEmailInput) {
  const resend = getResend();
  // Resend requires one of html, text, or react. Provide a minimal text
  // fallback if neither is supplied so the call is well-typed.
  const html = input.html;
  const text = input.text ?? (html ? undefined : input.subject);
  return resend.emails.send({
    from: input.from ?? FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    ...(html ? { html } : { text: text! }),
    replyTo: input.replyTo,
    ...(input.headers ? { headers: input.headers } : {}),
  });
}
