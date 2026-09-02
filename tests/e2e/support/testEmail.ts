/**
 * Every E2E test account lives under this one recognizable email domain —
 * confirmed 2026-09-02. This is the entire cleanup mechanism: `cleanup.ts`
 * deletes every `auth.users`/`public.users`/`companies` row whose email
 * matches this domain, nothing else. Never reuse this domain for anything
 * that should survive a cleanup run.
 *
 * A real, deliverable-looking domain is used deliberately (not
 * `@example.com`) — this codebase has already documented, live, that
 * Resend rejects `@example.com` as a reserved non-routable domain (see
 * "Real bug found" entries in CLAUDE.md's client-auth section), which
 * would make `signInWithOtp`'s own `admin.createUser()` call fail before
 * the test-auth route ever got a chance to run.
 */
export const TEST_EMAIL_DOMAIN = "elvanis-pw-e2e.test";

let counter = 0;

/** A fresh, namespaced test email — unique per call within a single run. */
export function freshTestEmail(label: string): string {
  counter += 1;
  const stamp = Date.now();
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `pw-${safeLabel}-${stamp}-${counter}@${TEST_EMAIL_DOMAIN}`;
}
