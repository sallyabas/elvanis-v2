import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe-token";
import { PREFERENCE_LABELS, type NotificationPreferences } from "@/lib/notifications/preferences";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/app/_components/ui/Card";
import { Alert } from "@/app/_components/ui/Alert";
import { UnsubscribeConfirm } from "./UnsubscribeConfirm";

/**
 * Public, no-login unsubscribe confirm page (confirmed 2026-09-03, email
 * redesign brief) — deliberately does NOT flip anything on this GET load.
 * It only verifies the token and renders a real confirm step; the actual
 * write happens from UnsubscribeConfirm's button click, via actions.ts's
 * confirmUnsubscribe — see that file's docblock for the full
 * bot-prescanning-safety reasoning (the same real failure class already
 * documented for this app's magic-link flow: an email provider's own
 * link-prescanning bot visits emailed URLs before a human does, and a
 * GET-triggered action would let that bot silently unsubscribe someone
 * who never clicked anything).
 *
 * Sits outside every route group ((app)/(reviewer)) since it's the one
 * genuinely public, no-auth surface a person reaches straight from an
 * email, same category as /client-login and /reviewer-login.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <Alert variant="error">This link is missing its token — please use the exact link from your email.</Alert>
      </Shell>
    );
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    return (
      <Shell>
        <Alert variant="error">This link is invalid. If you copied it from an email, please use the full link exactly as sent.</Alert>
      </Shell>
    );
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase.from("users").select("email").eq("id", verified.recipientId).maybeSingle();
  if (!user?.email) {
    return (
      <Shell>
        <Alert variant="error">We couldn&apos;t find the account for this link.</Alert>
      </Shell>
    );
  }

  const label = verified.key === "all" ? PREFERENCE_LABELS.optedOutOfAll : PREFERENCE_LABELS[verified.key as keyof NotificationPreferences];

  return (
    <Shell>
      <UnsubscribeConfirm token={token} label={label ?? "this type of email"} email={user.email as string} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Elvanis</div>
        <Card title="Email preferences">{children}</Card>
      </div>
    </div>
  );
}
