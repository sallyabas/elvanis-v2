import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountSettingsForm } from "./AccountSettingsForm";
import type { NotificationPreferences } from "./actions";
import { Card } from "@/app/_components/ui/Card";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  reportReady: true,
  reAuditReminder: true,
  evidenceIncomplete: true,
};

// Account Settings — about the person, not the business (confirmed
// 2026-08-04, Priority 3). Real: name, email (display only — it's the
// sign-in identity, changing it would mean re-verifying a new email, not
// built here), notification preferences (genuinely gates sending, not
// just a display toggle — see src/lib/notifications/dispatch.ts).
//
// Deliberately NOT built, flagged rather than faked: password management
// (this app is passwordless throughout, both client and reviewer auth —
// there is no password to manage) and real billing/subscription changes
// (no payment provider is integrated anywhere in this codebase — plan is
// shown, not editable, since there's nothing real to upgrade to yet).
export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: profile } = await supabase.from("users").select("name, email, notification_preferences, plan_tier").eq("id", user.id).single();

  const preferences = {
    ...DEFAULT_PREFERENCES,
    ...((profile?.notification_preferences as Partial<NotificationPreferences>) ?? {}),
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Account Settings</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">Your personal account, not the business.</p>

      <div className="space-y-6">
        <Card>
          <p className="mb-4 text-sm text-neutral-800 dark:text-neutral-200">
            <span className="font-medium">Email:</span> {profile?.email ?? user.email}
            <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">(sign-in identity — not editable here)</span>
          </p>
          <AccountSettingsForm initialName={profile?.name ?? ""} initialPreferences={preferences} />
        </Card>

        <Card>
          <p className="mb-1 text-sm text-neutral-800 dark:text-neutral-200">
            <span className="font-medium">Plan:</span> {profile?.plan_tier ?? "free"}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Billing management isn&apos;t available yet — no payment provider is connected.
          </p>
        </Card>
      </div>
    </div>
  );
}
