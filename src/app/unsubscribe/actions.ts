"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe-token";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from "@/lib/notifications/preferences";

export interface ConfirmUnsubscribeResult {
  success: boolean;
  error?: string;
}

/**
 * The actual state-changing step (confirmed 2026-09-03) — deliberately
 * only ever called from a real button click in UnsubscribeConfirm.tsx,
 * never as a side effect of the /unsubscribe page itself loading. This is
 * the bot-prescanning-safe half of the design: an email provider's own
 * link-prescanning bot (the same real, already-documented failure mode
 * that forced this codebase's magic-link flow to grow a 6-digit-code
 * fallback) visiting the emailed URL only ever renders the confirm page —
 * it never submits a click, so it can never silently unsubscribe someone
 * who hasn't actually decided to.
 *
 * Re-verifies the token itself rather than trusting anything the client
 * already displayed — the token IS the authorization, there's no session
 * to check (that's the entire point of a no-login unsubscribe link).
 */
export async function confirmUnsubscribe(token: string): Promise<ConfirmUnsubscribeResult> {
  const verified = verifyUnsubscribeToken(token);
  if (!verified) return { success: false, error: "This link is invalid or has expired." };

  const supabase = createAdminClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", verified.recipientId)
    .maybeSingle();
  if (userError || !user) return { success: false, error: "We couldn't find that account." };

  const current = (user.notification_preferences as Partial<NotificationPreferences>) ?? {};
  const updated: NotificationPreferences =
    verified.key === "all"
      ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...current, optedOutOfAll: true }
      : { ...DEFAULT_NOTIFICATION_PREFERENCES, ...current, [verified.key as keyof NotificationPreferences]: false };

  const { error: updateError } = await supabase.from("users").update({ notification_preferences: updated }).eq("id", verified.recipientId);
  if (updateError) return { success: false, error: `Couldn't save your preference: ${updateError.message}` };

  return { success: true };
}
