import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send-email";
import { renderEmail } from "./email-template";
import { EVENT_TYPE_TO_PREFERENCE_KEY, isOptedOut, type ClientNotificationEventType, type NotificationPreferences } from "./preferences";
import { TYPE_LABELS, sessionTypeToItemType } from "@/lib/item-type-badge";

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

type Admin = ReturnType<typeof createAdminClient>;

interface FindingTitleLookup {
  ai_draft: { title: string } | null;
  reviewer_edited_content: { title: string } | null;
}

/**
 * Real, branded template pass (confirmed 2026-09-03, email redesign
 * brief) — every email in this switch now: (1) uses copy in the
 * confirmed tone direction (direct, warm-but-not-cutesy, plain English,
 * names something real and specific whenever the data allows it, rather
 * than generic phrasing), and (2) returns only the inner {subject,
 * bodyHtml} pair — the actual wrapping into the shared branded shell
 * (email-template.ts) happens once, in sendPendingNotifications() below,
 * so every template automatically gets the same header/footer/
 * unsubscribe treatment with zero risk of one call site forgetting it.
 *
 * Reviewer-facing templates get no greeting/login-reminder/unsubscribe —
 * unchanged design call from 2026-08-06 (reviewers already know this
 * app's auth, and opting them out could break their own workflow).
 */
async function templateFor(
  admin: Admin,
  notification: {
    event_type: string;
    recipient_type: "client" | "reviewer";
    recipient_id: string;
    related_report_id: string | null;
    related_sprint_id: string | null;
    related_module_request_id: string | null;
    related_session_request_id: string | null;
    related_contact_request_id: string | null;
  },
): Promise<{ subject: string; bodyHtml: string }> {
  const eventType = notification.event_type;

  let companyName: string | null = null;
  if (notification.recipient_type === "client") {
    const { data: company } = await admin.from("companies").select("name").eq("user_id", notification.recipient_id).maybeSingle();
    companyName = (company?.name as string | undefined) ?? null;
  }
  const greeting = companyName ? `<p style="margin:0 0 16px 0;">Hi ${companyName} team,</p>` : "";
  const loginReminder = `<p style="margin:20px 0 0 0;font-size:13px;color:#6b6b69;">Sign in at <a href="${SITE_URL}/client-login" style="color:#6b6b69;">${SITE_URL}/client-login</a> with this same email — this app is passwordless, we'll send you a fresh sign-in link and code.</p>`;

  switch (eventType) {
    case "report_ready": {
      let reportUrl = `${SITE_URL}/reports`;
      let contentsHint = "your top 3 priorities and a 30/60/90 day roadmap";

      if (notification.related_report_id) {
        reportUrl = `${SITE_URL}/reports/${notification.related_report_id}`;
        const { data: report } = await admin.from("reports").select("top_3_finding_ids").eq("id", notification.related_report_id).maybeSingle();
        const top3Ids = (report?.top_3_finding_ids as string[] | undefined) ?? [];
        if (top3Ids.length > 0) {
          const { data: findings } = await admin.from("lens_findings").select("ai_draft, reviewer_edited_content").in("id", top3Ids);
          const titles = ((findings ?? []) as FindingTitleLookup[])
            .map((f) => f.reviewer_edited_content?.title ?? f.ai_draft?.title)
            .filter((t): t is string => Boolean(t));
          if (titles.length > 0) {
            contentsHint = `your top ${titles.length === 1 ? "priority" : `${titles.length} priorities`} — ${titles.join(", ")} — plus a 30/60/90 day roadmap`;
          }
        }
      }

      return {
        subject: companyName ? `${companyName}'s Elvanis report is ready` : "Your Elvanis report is ready",
        bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">Your execution audit is done, reviewed, and ready — including ${contentsHint}.</p><p style="margin:0;"><a href="${reportUrl}" style="color:#B87333;font-weight:600;">View your report →</a></p>${loginReminder}`,
      };
    }
    case "new_submission":
      return {
        subject: "New submission ready for review",
        bodyHtml: `<p style="margin:0 0 16px 0;">A new report has cleared its edit window and is ready for your review.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">Open the reviewer queue →</a></p>`,
      };
    case "evidence_incomplete":
      return notification.recipient_type === "client"
        ? {
            subject: "Pick up where you left off",
            bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">Your evidence submission is still in progress — no rush, but whenever you're ready, it's saved and waiting for you.</p><p style="margin:0;"><a href="${SITE_URL}/evidence-intake" style="color:#B87333;font-weight:600;">Continue your submission →</a></p>${loginReminder}`,
          }
        : {
            subject: "A client submission has stalled",
            bodyHtml: `<p style="margin:0;">A client's evidence submission has had no new activity for a while — worth a check-in.</p>`,
          };
    case "re_audit_reminder": {
      let sinceText = "your last audit";
      if (notification.related_report_id) {
        const { data: report } = await admin.from("reports").select("delivered_at").eq("id", notification.related_report_id).maybeSingle();
        if (report?.delivered_at) {
          sinceText = `your ${new Date(report.delivered_at as string).toLocaleDateString()} audit`;
        }
      }
      return {
        subject: "Time for your next execution audit",
        bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">It's been a while since ${sinceText} — a fresh look is usually worth it once things have moved on.</p><p style="margin:0;"><a href="${SITE_URL}/business-profile" style="color:#B87333;font-weight:600;">Start a re-audit →</a></p>${loginReminder}`,
      };
    }
    case "regulatory_content_review_due":
      return {
        subject: "Regulatory content review is overdue",
        bodyHtml: `<p style="margin:0 0 16px 0;">One or more jurisdictions' regulatory reference content is overdue for a manual re-check.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">Review status on the reviewer queue →</a></p>`,
      };
    case "session_requested":
      return {
        subject: "A client requested a live session",
        bodyHtml: `<p style="margin:0 0 16px 0;">A client has requested a Discovery, Delivery, or F2F Workshop session — worth following up to get it on the calendar.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">View on the reviewer queue →</a></p>`,
      };
    // Client-facing confirmation (confirmed 2026-09-05, direct founder
    // request) — real gap: no client-facing confirmation email ever
    // existed for any of the six session types, only the reviewer-facing
    // "session_requested" case above. Built consistently for all six.
    // Reuses TYPE_LABELS/sessionTypeToItemType (item-type-badge.tsx,
    // plain server-safe exports) rather than a third, independently-
    // drifting label map — that module already has the real display name
    // for every session type.
    case "session_request_confirmation": {
      let sessionTypeLabel = "session";
      if (notification.related_session_request_id) {
        const { data: request } = await admin
          .from("session_requests")
          .select("session_type")
          .eq("id", notification.related_session_request_id)
          .maybeSingle();
        if (request?.session_type) {
          sessionTypeLabel = TYPE_LABELS[sessionTypeToItemType(request.session_type as string)];
        }
      }
      return {
        subject: `We've got your ${sessionTypeLabel} request`,
        bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">We've received your ${sessionTypeLabel} request — your reviewer will follow up directly to get it scheduled.</p><p style="margin:0;"><a href="${SITE_URL}/reports" style="color:#B87333;font-weight:600;">Track it in Reports &amp; History →</a></p>${loginReminder}`,
      };
    }
    // Reviewer-facing (confirmed 2026-09-05, direct founder request) —
    // "Having trouble? Contact us," a genuinely new capture path
    // (contact_requests), distinct from the general mailto: link.
    case "contact_request_submitted": {
      let detail = "";
      if (notification.related_contact_request_id) {
        const { data: request } = await admin
          .from("contact_requests")
          .select("name, email, service_context")
          .eq("id", notification.related_contact_request_id)
          .maybeSingle();
        if (request) {
          detail = ` from ${request.name as string} (${request.email as string})${request.service_context ? `, re: ${request.service_context as string}` : ""}`;
        }
      }
      return {
        subject: "A client needs help",
        bodyHtml: `<p style="margin:0 0 16px 0;">A real "Having trouble?" request came in${detail}.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">View on the reviewer queue →</a></p>`,
      };
    }
    case "sprint_interest_requested":
      return {
        subject: "A client is interested in an Execution Sprint",
        bodyHtml: `<p style="margin:0 0 16px 0;">A client marked interest in help implementing one of their findings.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">View on the reviewer queue →</a></p>`,
      };
    case "sprint_queue_item":
      return {
        subject: "Execution Sprint needs your attention",
        bodyHtml: `<p style="margin:0 0 16px 0;">A client note or KPI deviation on an active Execution Sprint is waiting on a reply from you.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">Open the reviewer queue →</a></p>`,
      };
    case "sprint_signed_off":
      return {
        subject: "A client signed off on their Execution Sprint",
        bodyHtml: `<p style="margin:0 0 16px 0;">A client has signed off on their Execution Sprint — a final wrap-up commentary is still owed.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">Open the reviewer queue →</a></p>`,
      };
    case "session_declined":
      return {
        subject: "Update on your session request",
        bodyHtml: `${greeting}<p style="margin:0;">We can't schedule your session request right now — timing didn't line up on our end, not anything about your submission. Send a new request whenever works, and we'll get it on the calendar.</p>${loginReminder}`,
      };
    case "sprint_reply":
      // Client-facing — normally sent immediately by replyToSprintQueueItem
      // itself (its own call site now shares this same shell/preference
      // logic directly, confirmed 2026-09-03), not via this dispatcher;
      // this template is a fallback only for the rare case that immediate
      // send failed and the row is retried on the next cron tick.
      return {
        subject: "Reply to your Execution Sprint question",
        bodyHtml: `${greeting}<p style="margin:0;">Your reviewer replied to your Execution Sprint note — check your sprint page for the details.</p>${loginReminder}`,
      };
    case "sprint_proposed": {
      let sprintUrl = `${SITE_URL}/dashboard`;
      let findingHint = "one of your findings";
      if (notification.related_sprint_id) {
        sprintUrl = `${SITE_URL}/execution-sprint/${notification.related_sprint_id}`;
        const { data: sprint } = await admin
          .from("execution_sprints")
          .select("selected_finding_id")
          .eq("id", notification.related_sprint_id)
          .maybeSingle();
        if (sprint?.selected_finding_id) {
          const { data: finding } = await admin
            .from("lens_findings")
            .select("ai_draft, reviewer_edited_content")
            .eq("id", sprint.selected_finding_id as string)
            .maybeSingle();
          const title = (finding?.reviewer_edited_content as { title?: string } | null)?.title ?? (finding?.ai_draft as { title?: string } | null)?.title;
          if (title) findingHint = `"${title}"`;
        }
      }
      return {
        subject: "Your reviewer suggests an Execution Sprint",
        bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">Your reviewer suggests starting an Execution Sprint on ${findingHint}. Confirm it, or pick a different finding you'd previously marked "interested in help" on instead.</p><p style="margin:0;"><a href="${sprintUrl}" style="color:#B87333;font-weight:600;">Review and confirm →</a></p>${loginReminder}`,
      };
    }
    case "module_new_submission":
      return {
        subject: "New module request ready for review",
        bodyHtml: `<p style="margin:0 0 16px 0;">A new standalone module request is ready for your review.</p><p style="margin:0;"><a href="${SITE_URL}/queue" style="color:#B87333;font-weight:600;">Open the reviewer queue →</a></p>`,
      };
    case "module_ready":
      return {
        subject: companyName ? `${companyName}'s module results are ready` : "Your module results are ready",
        bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">Your requested module results are done, reviewed, and ready.</p><p style="margin:0;"><a href="${SITE_URL}/reports" style="color:#B87333;font-weight:600;">View in Reports &amp; History →</a></p>${loginReminder}`,
      };
    case "report_feedback_request": {
      const url = notification.related_report_id
        ? `${SITE_URL}/reports/${notification.related_report_id}`
        : notification.related_module_request_id
          ? `${SITE_URL}/services/module/${notification.related_module_request_id}`
          : `${SITE_URL}/reports`;
      return {
        subject: "How was your Elvanis report?",
        bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">We'd love a minute of honest feedback on what you just received — it genuinely shapes what we build next.</p><p style="margin:0;"><a href="${url}" style="color:#B87333;font-weight:600;">Leave feedback →</a></p>${loginReminder}`,
      };
    }
    case "pilot_testimonial_request": {
      const url = notification.related_report_id
        ? `${SITE_URL}/reports/${notification.related_report_id}`
        : notification.related_module_request_id
          ? `${SITE_URL}/services/module/${notification.related_module_request_id}`
          : `${SITE_URL}/reports`;
      return {
        subject: "Would you share a testimonial or referral?",
        bodyHtml: `${greeting}<p style="margin:0 0 16px 0;">You're one of our first pilot clients, and your experience genuinely shapes where this goes next. If it was worth your time, a short testimonial — or an introduction to another founder who'd get value from it — would mean a lot.</p><p style="margin:0;"><a href="${url}" style="color:#B87333;font-weight:600;">Share a testimonial or referral →</a></p>${loginReminder}`,
      };
    }
    default:
      return {
        subject: "Elvanis notification",
        bodyHtml: `<p style="margin:0;">You have a new notification.</p>`,
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
    .select(
      "id, recipient_type, recipient_id, event_type, related_report_id, related_sprint_id, related_module_request_id, related_session_request_id, related_contact_request_id",
    )
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

      const eventType = notification.event_type as string;
      const preferenceKey = EVENT_TYPE_TO_PREFERENCE_KEY[eventType as ClientNotificationEventType];
      if (preferenceKey) {
        const preferences = (user.notification_preferences as Partial<NotificationPreferences>) ?? {};
        // isOptedOut() checks the master `optedOutOfAll` switch first, then
        // the specific per-type key — defaults to "send" (false) when
        // neither is set, same as before, so an account that never
        // touched Account Settings doesn't silently go dark.
        if (isOptedOut(preferences, preferenceKey)) {
          skippedByPreference++;
          // Still stamped as sent — the client chose not to receive it,
          // this isn't a delivery failure to retry.
          await supabase.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", notification.id as string);
          continue;
        }
      }

      const { subject, bodyHtml } = await templateFor(supabase, {
        event_type: eventType,
        recipient_type: notification.recipient_type as "client" | "reviewer",
        recipient_id: notification.recipient_id as string,
        related_report_id: (notification.related_report_id as string | null) ?? null,
        related_sprint_id: (notification.related_sprint_id as string | null) ?? null,
        related_module_request_id: (notification.related_module_request_id as string | null) ?? null,
        related_session_request_id: (notification.related_session_request_id as string | null) ?? null,
        related_contact_request_id: (notification.related_contact_request_id as string | null) ?? null,
      });

      const html = renderEmail({
        bodyHtml,
        recipientEmail: user.email as string,
        siteUrl: SITE_URL,
        // Unsubscribe links only for client-facing event types that carry
        // a real preference key — reviewer-facing ones (preferenceKey
        // undefined here) get no unsubscribe section at all.
        unsubscribe: preferenceKey ? { recipientId: notification.recipient_id as string, preferenceKey } : undefined,
      });

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
