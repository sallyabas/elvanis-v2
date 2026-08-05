import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send-email";

/**
 * The "separate, explicit, confirmed step" every notification-creating
 * function in this codebase (checkAndNotifyClosedEditWindows,
 * checkEvidenceCompletenessNudges, checkReAuditReminders,
 * checkRegulatoryContentReviewDue, deliverReport) has deliberately
 * deferred to — each of those logs a real `notifications` row with
 * `sent_at: null` and stops there. This is that step, confirmed
 * 2026-08-04: queries every unsent row, sends a real email via Resend,
 * and stamps `sent_at` on success. One send failing must never block the
 * others — same Promise.allSettled-style resilience principle used
 * throughout this codebase (the 5 lenses, the cron tick's own checks).
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Maps client-facing event types to the matching Account Settings
 * preference key (confirmed 2026-08-04, Priority 3) — a real opt-out, not
 * a decorative toggle. Only client-facing events are gated; reviewer
 * notifications (new_submission, regulatory_content_review_due) aren't,
 * since a reviewer opting out could silently break their own reviewing
 * workflow — not asked for, not built.
 */
const CLIENT_PREFERENCE_KEY: Partial<Record<string, string>> = {
  report_ready: "reportReady",
  re_audit_reminder: "reAuditReminder",
  evidence_incomplete: "evidenceIncomplete",
};

function templateFor(eventType: string, recipientType: "client" | "reviewer"): { subject: string; html: string } {
  switch (eventType) {
    case "report_ready":
      return {
        subject: "Your Elvanis report is ready",
        html: `<p>Your execution audit report is ready to view.</p><p><a href="${SITE_URL}/reports">View your report</a></p>`,
      };
    case "new_submission":
      return {
        subject: "New submission ready for review",
        html: `<p>A new report has cleared its edit window and is ready for reviewer approval.</p><p><a href="${SITE_URL}/queue">Open the reviewer queue</a></p>`,
      };
    case "evidence_incomplete":
      return recipientType === "client"
        ? {
            subject: "Finish submitting your evidence",
            html: `<p>Your evidence submission is still incomplete. Finish it whenever you're ready — there's no rush, but we wanted to check in.</p>`,
          }
        : {
            subject: "A client submission has stalled",
            html: `<p>A client's evidence submission has had no new activity for a while. You may want to follow up.</p>`,
          };
    case "re_audit_reminder":
      return {
        subject: "Time for your next execution audit",
        html: `<p>It's been a while since your last audit — worth checking in on how things have progressed.</p><p><a href="${SITE_URL}/business-profile">Start a re-audit</a></p>`,
      };
    case "regulatory_content_review_due":
      return {
        subject: "Regulatory content review is overdue",
        html: `<p>One or more jurisdictions' regulatory reference content is overdue for a manual re-check.</p><p><a href="${SITE_URL}/queue">Review status on the reviewer queue</a></p>`,
      };
    case "session_requested":
      // Reviewer-facing only (see session-requests.ts) — a client requested
      // a Discovery/Delivery/F2F Workshop call, not something a client
      // themselves would receive an email about.
      return {
        subject: "A client requested a live session",
        html: `<p>A client has requested a Discovery, Delivery, or F2F Workshop session. Follow up to schedule it.</p><p><a href="${SITE_URL}/queue">View on the reviewer queue</a></p>`,
      };
    default:
      return {
        subject: "Elvanis notification",
        html: `<p>You have a new notification.</p>`,
      };
  }
}

export interface DispatchResult {
  sent: number;
  failed: number;
  skippedByPreference: number;
}

export async function sendPendingNotifications(): Promise<DispatchResult> {
  const supabase = createAdminClient();

  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, recipient_type, recipient_id, event_type")
    .is("sent_at", null)
    .eq("channel", "email");
  if (error) throw new Error(`sendPendingNotifications: failed to load pending notifications: ${error.message}`);
  if (!pending || pending.length === 0) return { sent: 0, failed: 0, skippedByPreference: 0 };

  let sent = 0;
  let failed = 0;
  let skippedByPreference = 0;

  for (const notification of pending) {
    try {
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("email, notification_preferences")
        .eq("id", notification.recipient_id as string)
        .single();
      if (userError || !user?.email) throw new Error(`no email found for recipient ${notification.recipient_id}`);

      const preferenceKey = CLIENT_PREFERENCE_KEY[notification.event_type as string];
      if (preferenceKey) {
        const preferences = (user.notification_preferences as Record<string, boolean>) ?? {};
        // Defaults to true (send) when the key is unset — an account that
        // never touched Account Settings shouldn't silently go dark.
        if (preferences[preferenceKey] === false) {
          skippedByPreference++;
          // Still stamped as sent — the client chose not to receive it,
          // this isn't a delivery failure to retry.
          await supabase.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", notification.id as string);
          continue;
        }
      }

      const { subject, html } = templateFor(notification.event_type as string, notification.recipient_type as "client" | "reviewer");
      await sendEmail({ to: user.email as string, subject, html });

      const { error: updateError } = await supabase
        .from("notifications")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", notification.id as string);
      if (updateError) throw new Error(`failed to stamp sent_at: ${updateError.message}`);

      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed, skippedByPreference };
}
