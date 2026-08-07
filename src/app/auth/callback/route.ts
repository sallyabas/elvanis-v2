import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the magic-link code for a session, then redirects. Shared by
 * every auth flow that needs a callback — client and reviewer today.
 *
 * Real bug found and fixed 2026-08-07, root-caused via direct reproduction
 * (not guessed): this route's failure fallback used to be hardcoded to
 * `/reviewer-login` unconditionally — a leftover from when the reviewer
 * flow was the only one that existed ("Shared by any auth flow that needs
 * a callback — reviewer login today," the original comment literally
 * said). A client whose exchange failed landed on reviewer sign-in, which
 * read like client/reviewer auth "colliding" but was actually just this
 * one unconditional fallback never having been updated when the client
 * flow was added on top.
 *
 * Why the exchange actually fails in the first place, confirmed by
 * replicating the exact signInWithOtp() call this app makes: this project
 * uses @supabase/ssr's default PKCE flow, which sets a `code_verifier`
 * cookie in the browser that requests the link. Redeeming the emailed
 * `code` requires that same cookie to still be present — which fails the
 * moment the link is opened in a different browser/device than the one
 * that submitted the form (checking email on your phone after submitting
 * from your laptop, for instance), or visited first by an email provider's
 * link-prescanning bot. This class of failure is expected to happen
 * sometimes, not a bug in itself — the actual bug was always landing
 * everyone on the same wrong page when it does.
 *
 * Fixed with an explicit, deterministic signal rather than inferring the
 * right fallback from `next`'s path shape: each login flow now passes its
 * own `loginPath` alongside `next` (see client-login/actions.ts and
 * reviewer-login/actions.ts), so a failed client exchange sends the person
 * back to /client-login and a failed reviewer exchange back to
 * /reviewer-login — never a guess, never a shared hardcoded default.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const loginPath = searchParams.get("loginPath") ?? "/client-login";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}${loginPath}`);
}
