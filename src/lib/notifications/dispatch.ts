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

type Admin = ReturnType<typeof createAdminClient>;

interface FindingTitleLookup {
  ai_draft: { title: string } | null;
  reviewer_edited_content: { title: string } | null;
}

/**
 * Client-facing email templates, expanded 2026-08-06 (honest UX review
 * pass) — real gaps, not polish. Every client-facing template used to be
 * a single generic sentence plus a link to /reports (the list page, not
 * the specific report), with no company name, no hint at what the email
 * was actually about, and no reminder that this app is passwordless
 * (magic-link + code) — a genuine first-time client who submitted
 * evidence days ago may not remember how sign-in works. Now:
 * - company name looked up via companies.user_id = recipient_id (one
 *   company per account in V1, so this is unambiguous)
 * - report_ready and re_audit_reminder use the new related_report_id
 *   column to link directly to the specific report and, for report_ready,
 *   pull the REAL top-3 finding titles rather than generic boilerplate
 *   ("hint at what's inside" is more honestly satisfied by the actual
 *   content than a canned sentence, consistent with this codebase's
 *   standing "never fake content" discipline)
 * - a passwordless-login reminder is appended to every client-facing
 *   template
 * Reviewer-facing templates are untouched — reviewers already know how
 * this app's auth works, that wasn't the finding.
 */
async function templateFor(
  admin: Admin,
  notification: {
    event_type: string;
    recipient_type: "client" | "reviewer";
    recipient_id: string;
    related_report_id: string | null;
    related_sprint_id: string | null;
  },
): Promise<{ subject: string; html: string }> {
  const eventType = notification.event_type;

  let companyName: string | null = null;
  if (notification.recipient_type === "client") {
    const { data: company } = await admin.from("companies").select("name").eq("user_id", notification.recipient_id).maybeSingle();
    companyName = (company?.name as string | undefined) ?? null;
  }
  const greeting = companyName ? `<p>Hi ${companyName} team,</p>` : "";
  const loginReminder = `<p style="color:#666;font-size:13px;">Sign in at <a href="${SITE_URL}/client-login">${SITE_URL}/client-login</a> with this same email — this app is passwordless, we'll send you a fresh sign-in link and code.</p>`;

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
        html: `${greeting}<p>Your execution audit report is ready, including ${contentsHint}.</p><p><a href="${reportUrl}">View your report</a></p>${loginReminder}`,
      };
    }
    case "new_submission":
      return {
        subject: "New submission ready for review",
        html: `<p>A new report has cleared its edit window and is ready for reviewer approval.</p><p><a href="${SITE_URL}/queue">Open the reviewer queue</a></p>`,
      };
    case "evidence_incomplete":
      return notification.recipient_type === "client"
        ? {
            subject: "Finish submitting your evidence",
            html: `${greeting}<p>Your evidence submission is still incomplete. Finish it whenever you're ready — there's no rush, but we wanted to check in.</p><p><a href="${SITE_URL}/evidence-intake">Continue your submission</a></p>${loginReminder}`,
          }
        : {
            subject: "A client submission has stalled",
            html: `<p>A client's evidence submission has had no new activity for a while. You may want to follow up.</p>`,
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
        html: `${greeting}<p>It's been a while since ${sinceText} — worth checking in on how things have progressed.</p><p><a href="${SITE_URL}/business-profile">Start a re-audit</a></p>${loginReminder}`,
      };
    }
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
    case "sprint_interest_requested":
      // Reviewer-facing — a client marked interest in help implementing a
      // specific high-priority finding (confirmed 2026-08-06, honest UX
      // review pass). Doesn't create the sprint itself; the reviewer still
      // starts it from the report workspace's existing "Start an
      // Execution Sprint" entry point.
      return {
        subject: "A client is interested in an Execution Sprint",
        html: `<p>A client marked interest in help implementing one of their findings.</p><p><a href="${SITE_URL}/queue">View on the reviewer queue</a></p>`,
      };
    case "sprint_queue_item":
      // Reviewer-facing — a client submitted a plan-change note, or a KPI
      // actual deviated past the configured threshold on an active
      // Execution Sprint (confirmed 2026-08-06, "same mechanism, different
      // trigger").
      return {
        subject: "Execution Sprint needs your attention",
        html: `<p>A client note or KPI deviation on an active Execution Sprint is waiting for a reply.</p><p><a href="${SITE_URL}/queue">Open the reviewer queue</a></p>`,
      };
    case "sprint_signed_off":
      // Reviewer-facing — the client signed off on their Execution Sprint;
      // a final wrap-up commentary is still owed (addSprintReviewerCommentary).
      return {
        subject: "A client signed off on their Execution Sprint",
        html: `<p>A client has signed off on their Execution Sprint. Add your final wrap-up commentary when ready.</p><p><a href="${SITE_URL}/queue">Open the reviewer queue</a></p>`,
      };
    case "session_declined":
      // Client-facing (confirmed 2026-08-11, live testing pass) — closes a
      // real gap: declining a session request previously fired no
      // notification at all. Kept generic (no specific decline reason in
      // the email body) — there's no related_session_request_id column
      // yet to look the reason back up, same pattern related_report_id
      // already solves for report_ready/re_audit_reminder; a real,
      // deliberately deferred enrichment, not built here to avoid
      // stretching this pass's scope.
      return {
        subject: "Update on your session request",
        html: `${greeting}<p>We're not able to schedule the session you requested right now. Feel free to reach back out or submit a new request anytime.</p>${loginReminder}`,
      };
    case "sprint_reply":
      // Client-facing — normally sent immediately by replyToSprintQueueItem
      // itself, not via this dispatcher; this template is a fallback only
      // for the rare case that immediate send failed and the row is
      // retried on the next cron tick.
      return {
        subject: "Reply to your Execution Sprint question",
        html: `${greeting}<p>Your reviewer replied to your Execution Sprint note. Check your sprint page for details.</p>${loginReminder}`,
      };
    case "sprint_proposed": {
      // Client-facing (confirmed 2026-08-18, closes the real "sprint just
      // appears already started" gap) — fires the moment a reviewer
      // proposes a sprint, before any task-scoping happens. Links to the
      // specific sprint via related_sprint_id (same structured-link
      // precedent as related_report_id) and names the actual proposed
      // finding, same "hint at what's inside with real content" standard
      // already applied to report_ready.
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
        html: `${greeting}<p>Your reviewer suggests starting an Execution Sprint on ${findingHint}. Confirm it, or pick a different finding you'd previously marked "interested in help" on instead.</p><p><a href="${sprintUrl}">Review and confirm</a></p>${loginReminder}`,
      };
    }
    case "module_new_submission":
      // Reviewer-facing (confirmed 2026-08-15, module intake/service flow
      // review) — closes a real gap: a standalone module request
      // (Tender Readiness / AI Reliability Audit / Data Protection
      // Compliance) previously logged no notification of any kind at
      // submission, unlike a core-audit report (new_submission). Kept
      // generic (no direct link to the specific request — there's no
      // related_module_request_id column, same disclosed scope limit
      // already accepted for session_declined) — the reviewer queue
      // already lists every pending module request.
      return {
        subject: "New module request ready for review",
        html: `<p>A new standalone module request is ready for reviewer review.</p><p><a href="${SITE_URL}/queue">Open the reviewer queue</a></p>`,
      };
    case "module_ready":
      // Client-facing (confirmed 2026-08-15) — mirrors report_ready exactly:
      // logged the moment deliverModuleRequest() flips a request to `sent`,
      // sent on the next dispatch pass. No client-facing module detail view
      // exists yet (Reports & History shows "Detail view coming soon" for
      // modules, a real, separately-flagged gap) — links to /reports, the
      // one place a client can currently see the request listed at all,
      // rather than a link to a page that doesn't exist.
      return {
        subject: companyName ? `${companyName}'s module results are ready` : "Your module results are ready",
        html: `${greeting}<p>Your requested module results are ready for review.</p><p><a href="${SITE_URL}/reports">View in Reports &amp; History</a></p>${loginReminder}`,
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
    .select("id, recipient_type, recipient_id, event_type, related_report_id, related_sprint_id")
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

      const { subject, html } = await templateFor(supabase, {
        event_type: notification.event_type as string,
        recipient_type: notification.recipient_type as "client" | "reviewer",
        recipient_id: notification.recipient_id as string,
        related_report_id: (notification.related_report_id as string | null) ?? null,
        related_sprint_id: (notification.related_sprint_id as string | null) ?? null,
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
