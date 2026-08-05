"use server";

import { createClient } from "@/lib/supabase/server";

export interface NotificationPreferences {
  reportReady: boolean;
  reAuditReminder: boolean;
  evidenceIncomplete: boolean;
}

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
 * any client-facing event type.
 */
export async function updateAccountSettings(name: string, preferences: NotificationPreferences): Promise<UpdateAccountSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase
    .from("users")
    .update({ name: name.trim() || null, notification_preferences: preferences })
    .eq("id", user.id);

  if (error) return { success: false, error: `Couldn't save: ${error.message}` };
  return { success: true };
}
