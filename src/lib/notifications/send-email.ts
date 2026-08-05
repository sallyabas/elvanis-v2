import { Resend } from "resend";

/**
 * The only file allowed to call Resend's API directly (confirmed
 * 2026-08-04, Priority 2) — same "one file per provider" pattern already
 * established for ai-client (Groq) and search-client (Tavily). Resend's
 * account/domain was verified working during infra setup via a raw test
 * send, but until now nothing in the application ever actually called it
 * — every notification path logged a `notifications` row with
 * `sent_at: null` and stopped there, deliberately, pending explicit
 * confirmation this step should fire for real.
 */

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
    client = new Resend(apiKey);
  }
  return client;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");

  const { error } = await getClient().emails.send({
    from: `Elvanis <${from}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (error) throw new Error(`sendEmail failed: ${error.message}`);
}
