"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RequestMagicLinkResult {
  sent: boolean;
  error?: string;
}

/**
 * Client sign-in, mirroring reviewer-login's magic-link + code pattern
 * (src/app/reviewer-login/actions.ts) with one deliberate difference:
 * genuine self-serve signup, not gated to pre-provisioned accounts.
 * `signInWithOtp` defaults to `shouldCreateUser: true`, so a first-time
 * email creates a real `auth.users` account automatically — there is no
 * reviewer-style admin gate here, since any prospective client should be
 * able to sign up. The corresponding `public.users` row (role defaults to
 * 'client' at the schema level) is ensured to exist by the (app) layout on
 * first authenticated page load, not here — see layout.tsx.
 */
export async function requestClientMagicLink(email: string, origin: string): Promise<RequestMagicLinkResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { sent: false, error: "Enter an email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/business-profile` },
  });

  if (error) return { sent: false, error: "Couldn't send the login link. Try again in a moment." };
  return { sent: true };
}

export interface VerifyCodeResult {
  success: boolean;
  error?: string;
}

/**
 * Fallback to the clickable link, not a replacement for it — same reason
 * as the reviewer flow (Gmail's automatic link-prescanning can consume a
 * real single-use magic link before the human clicks it).
 */
export async function verifyClientCode(email: string, token: string): Promise<VerifyCodeResult> {
  const trimmed = email.trim().toLowerCase();
  const trimmedToken = token.trim();
  if (!trimmed || !trimmedToken) return { success: false, error: "Enter both your email and the code." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: trimmed, token: trimmedToken, type: "email" });

  if (error) return { success: false, error: "That code didn't work — check it and try again, or request a new one." };
  return { success: true };
}

/**
 * Ensures a `public.users` row exists for the now-authenticated session,
 * defaulting to role='client' — there is no DB trigger syncing auth.users
 * to public.users (confirmed by checking migrations directly; only
 * scripts/grant-reviewer.ts manually upserts this row, and only for
 * reviewers). Never overwrites an existing role — a reviewer account
 * visiting a client page must stay a reviewer, not get silently
 * downgraded. Called from the (app) layout on every authenticated request.
 *
 * Real bug found and fixed live 2026-08-03: the original version did a
 * check-then-insert (SELECT, then INSERT if no row) — not atomic, and Next
 * JS's layout can genuinely be invoked more than once for overlapping
 * requests. Two concurrent calls both saw "no row exists," both tried to
 * INSERT, and the second hit `duplicate key value violates unique
 * constraint "users_pkey"`. Fixed with a real upsert (`ON CONFLICT (id) DO
 * NOTHING` via `ignoreDuplicates: true`), atomic at the database level —
 * no read-then-write race window at all, and still never overwrites an
 * existing role, since a conflict is a no-op rather than an update.
 */
export async function ensureClientUserRow(userId: string, email: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("users").upsert({ id: userId, email, role: "client" }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`ensureClientUserRow failed: ${error.message}`);
}
