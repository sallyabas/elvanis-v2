"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RequestMagicLinkResult {
  sent: boolean;
  error?: string;
}

/**
 * Only sends a magic link to emails already granted reviewer access (see
 * scripts/grant-reviewer.ts) — checked via the admin client since the
 * caller has no session yet. Deliberately does not distinguish "no such
 * account" from "not a reviewer" in the error message; both get the same
 * generic response.
 */
export async function requestReviewerMagicLink(email: string, origin: string): Promise<RequestMagicLinkResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { sent: false, error: "Enter an email address." };

  const admin = createAdminClient();
  const { data: reviewerRow } = await admin
    .from("users")
    .select("id")
    .eq("email", trimmed)
    .eq("role", "reviewer")
    .maybeSingle();

  if (!reviewerRow) {
    return { sent: false, error: "This email isn't set up for reviewer access. Contact the administrator." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    // loginPath, confirmed 2026-08-07 — see client-login/actions.ts and
    // auth/callback/route.ts for the full root-cause this closes: the
    // shared callback's failure fallback used to be hardcoded to
    // /reviewer-login for every flow; each flow now names its own.
    options: { emailRedirectTo: `${origin}/auth/callback?next=/queue&loginPath=/reviewer-login` },
  });

  if (error) return { sent: false, error: "Couldn't send the login link. Try again in a moment." };
  return { sent: true };
}

export interface VerifyCodeResult {
  success: boolean;
  error?: string;
}

/**
 * Fallback to the clickable link, not a replacement for it — added
 * 2026-08-02 after Gmail's automatic link-prescanning consumed a real
 * single-use magic link before the human clicked it (a well-known
 * Supabase+Gmail interaction, surfaces as otp_expired). A scanner that
 * visits a URL can't submit a 6-digit code it never sees, so this path is
 * immune to that failure mode. Requires the "Magic Link" email template to
 * actually display {{ .Token }} — Supabase always generates the code
 * server-side regardless of the template, but won't show it unless the
 * template includes it.
 */
export async function verifyReviewerCode(email: string, token: string): Promise<VerifyCodeResult> {
  const trimmed = email.trim().toLowerCase();
  const trimmedToken = token.trim();
  if (!trimmed || !trimmedToken) return { success: false, error: "Enter both your email and the code." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: trimmed, token: trimmedToken, type: "email" });

  if (error) return { success: false, error: "That code didn't work — check it and try again, or request a new one." };
  return { success: true };
}
