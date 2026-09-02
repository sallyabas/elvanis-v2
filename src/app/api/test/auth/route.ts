import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * TEST-ONLY authentication bypass — confirmed 2026-09-02, built for the
 * Playwright E2E suite (tests/e2e/).
 *
 * WHAT THIS IS: this app is 100% passwordless (magic-link + 6-digit code,
 * no passwords anywhere — see "Client authentication"/"Reviewer
 * authentication" elsewhere in CLAUDE.md). A real automated test can't
 * click a link in a real inbox, so this route establishes a REAL, valid
 * session for a given email using the exact same mechanism this
 * codebase's own test-and-verify passes have used by hand all session
 * (`admin.generateLink()` + `verifyOtp()` through the app's own real
 * `createClient()` cookie-writing code path) — not a fake/mocked session,
 * a genuine one, indistinguishable from a real sign-in once established.
 *
 * WHY A ROUTE, NOT HAND-CONSTRUCTED COOKIES IN THE TEST HARNESS: the
 * alternative (Playwright manually building the `@supabase/ssr` cookie
 * format) depends on that package's internal, non-public cookie encoding,
 * which could silently break on a future version bump with no compiler
 * error — just a mysteriously-failing suite. Going through the app's own
 * real route guarantees the cookie shape can never drift out of sync with
 * what the rest of the app actually expects.
 *
 * SAFETY — double-gated, inert by default:
 *   1. Returns a bare 404 (not 403 — never reveals this route exists)
 *      unless `process.env.ALLOW_TEST_AUTH === "true"`.
 *   2. Even then, requires an `x-test-auth-secret` header matching
 *      `process.env.TEST_AUTH_SECRET` — a stray env flag alone can't be
 *      exploited without also knowing the secret.
 *
 * `ALLOW_TEST_AUTH` must NEVER be set on the production Vercel project
 * (the one bound to app.elvanis.com or its current placeholder domain).
 * It is meant only for local dev and a dedicated preview/staging
 * deployment the E2E suite targets — same operational treatment as
 * `CRON_SECRET` already gets elsewhere in this codebase (a real secret,
 * documented, deliberately never enabled on the live production domain).
 *
 * A future security review should treat this route as intentional,
 * documented infrastructure, not an oversight — that's the point of this
 * comment block existing here rather than only in CLAUDE.md.
 */
export async function POST(req: NextRequest) {
  if (process.env.ALLOW_TEST_AUTH !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const secret = req.headers.get("x-test-auth-secret");
  if (!secret || secret !== process.env.TEST_AUTH_SECRET) {
    return new NextResponse(null, { status: 404 });
  }

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Real bug found running this suite for the first time, not assumed:
  // `admin.generateLink({type: "magiclink"})` against a genuinely brand-new
  // email produced a token that then failed verifyOtp with "Email link is
  // invalid or has expired" — the exact same root cause already diagnosed
  // and fixed once for the real signup flow (see client-login/actions.ts's
  // own docblock, "First-time signup was three steps, not one"): a
  // brand-new user needs to be explicitly pre-confirmed via
  // `admin.createUser({email_confirm: true})` before Supabase will treat a
  // magic-link/OTP request for that email as an already-confirmed sign-in
  // rather than a separate "confirm signup" flow. Reusing that exact,
  // already-proven pattern here — `email_exists` is treated as success
  // (the account already exists and is presumably already confirmed from a
  // prior test run or a real signup), matching requestClientMagicLink()'s
  // own established handling verbatim.
  const { error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (createError && createError.code !== "email_exists") {
    return NextResponse.json({ error: `pre-confirm createUser failed: ${createError.message}` }, { status: 500 });
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? "no hashed_token returned" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
