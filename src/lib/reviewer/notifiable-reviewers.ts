import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Real, confirmed bug fix (2026-09-14) — every one of this codebase's ~12
 * reviewer-notification fan-out sites queried `role = 'reviewer'` directly
 * and unconditionally, then inserted one `notifications` row per match.
 * E2E tests run against this app's one real, live Supabase project (no
 * separate test database exists — confirmed by reading
 * NEXT_PUBLIC_SUPABASE_URL in .env.local and playwright.config.ts's own
 * webServer.env, which only ever overrides ANTHROPIC_API_KEY) and create
 * real `role='reviewer'` rows for their own disposable test accounts —
 * but every one of those fan-out queries ALSO matched the founder's own
 * real, permanent reviewer account on every run, inserting a real
 * `notifications` row addressed to it. tests/e2e/support/cleanup.ts only
 * ever deleted the disposable test accounts themselves (by email domain)
 * — never these leaked rows, since they're addressed to a real, non-test
 * `recipient_id` cleanup was never looking for. The rows sat pending
 * (`sent_at: null`) until Vercel's production GitHub Actions cron —
 * completely unaware of where they came from — drained the whole table
 * and genuinely emailed them via Resend, sometimes days later. Confirmed
 * live before this fix: 131 pending + 350 already-sent notification rows
 * addressed to the founder's real inbox, 100% traceable to Playwright
 * fixture companies ("Playwright Review Co <timestamp>"), zero to any
 * real kept-proof account.
 *
 * Fixed at the one place every fan-out site already shares a shape (a
 * plain `role='reviewer'` id list) — this is now the ONLY place that
 * query is allowed to run. It silently drops any recipient whose email
 * appears in TEST_EXCLUDE_REVIEWER_EMAILS (comma-separated, empty/unset
 * in real production) — the exact same env-gated-safety-override pattern
 * already established for ANTHROPIC_API_KEY in playwright.config.ts's
 * webServer.env. That config now sets it to the founder's real email for
 * every spawned local test-dev-server run, so a fresh E2E run can never
 * again insert a notification row targeting a real inbox, with zero
 * change to real production behavior (the env var is never set outside a
 * test run).
 */
export async function loadNotifiableReviewers(supabase: SupabaseClient): Promise<{ id: string }[]> {
  const { data, error } = await supabase.from("users").select("id, email").eq("role", "reviewer");
  if (error) throw new Error(`loadNotifiableReviewers: failed to load reviewers: ${error.message}`);

  const excluded = (process.env.TEST_EXCLUDE_REVIEWER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (excluded.length === 0) return (data ?? []).map((r) => ({ id: r.id as string }));

  return (data ?? []).filter((r) => !excluded.includes((r.email as string | null)?.toLowerCase() ?? "")).map((r) => ({ id: r.id as string }));
}
