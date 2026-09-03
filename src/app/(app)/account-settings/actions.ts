"use server";

import { createClient } from "@/lib/supabase/server";
import type { NotificationPreferences } from "@/lib/notifications/preferences";

// Real bug found and fixed live (confirmed 2026-09-03) — this file
// previously also did `export type { NotificationPreferences }` so
// page.tsx/AccountSettingsForm.tsx could import it from here. Next.js's
// Server Actions compiler treats every export of a "use server" file as
// a server-action reference, and a type-only re-export broke that
// (`ReferenceError: NotificationPreferences is not defined` at module
// evaluation, a real 500 on every save). Callers now import the type
// directly from lib/notifications/preferences.ts instead — the actual
// source of truth — never through this file.
export interface UpdateAccountSettingsResult {
  success: boolean;
  error?: string;
}

/**
 * Real Account Settings (confirmed 2026-08-04, Priority 3) — name and
 * notification preferences. Deliberately does NOT include password
 * management (this app is passwordless throughout — magic-link + code,
 * both client and reviewer auth — there is no password to manage) or real
 * billing/subscription changes (no payment provider is integrated
 * anywhere in this codebase; `users.plan_tier` is displayed, not
 * editable, since there's nothing real to change it to yet). Both flagged
 * explicitly rather than building a fake control for either.
 *
 * `notification_preferences` genuinely gates sending, not just a display
 * toggle — src/lib/notifications/dispatch.ts checks this before sending
 * any client-facing event type. Widened 2026-09-03 from 3 keys to all 9
 * client-facing event types plus a real `optedOutOfAll` master switch —
 * the same flag the real /unsubscribe flow's "unsubscribe from
 * everything" option sets, so a client who opted out via email can see
 * and reverse it here too, not get permanently stuck.
 */
export async function updateAccountSettings(name: string, phone: string, preferences: NotificationPreferences): Promise<UpdateAccountSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase
    .from("users")
    .update({ name: name.trim() || null, phone: phone.trim() || null, notification_preferences: preferences })
    .eq("id", user.id);

  if (error) return { success: false, error: `Couldn't save: ${error.message}` };
  return { success: true };
}
