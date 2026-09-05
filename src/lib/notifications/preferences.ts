/**
 * Notification-preference source of truth (confirmed 2026-09-03, email
 * redesign brief) — extends what was previously 3 hardcoded, ad hoc keys
 * (`reportReady`/`reAuditReminder`/`evidenceIncomplete`, each independently
 * spelled out in dispatch.ts AND account-settings/actions.ts AND
 * account-settings/page.tsx) to cover every one of the 9 client-facing
 * event types this app actually sends, plus a real `optedOutOfAll` master
 * switch — the piece the real unsubscribe endpoint needs (a client who
 * clicks "unsubscribe from everything" needs one flag every send path
 * checks first, not 9 separately-flipped booleans).
 *
 * Pulled into its own module so dispatch.ts, account-settings, and the new
 * /unsubscribe page/action all read the exact same keys/labels — the
 * previous 3-key version had already started drifting (dispatch.ts's
 * CLIENT_PREFERENCE_KEY and account-settings' own hardcoded list were two
 * separate literals that happened to agree, not one shared definition).
 *
 * Reviewer-facing event types are deliberately NOT here — confirmed
 * 2026-09-03, unchanged from the original 2026-08-04 design call ("a
 * reviewer opting out could silently break their own reviewing
 * workflow") — no preference key, no unsubscribe link, for any of them.
 */

export type ClientNotificationEventType =
  | "report_ready"
  | "re_audit_reminder"
  | "evidence_incomplete"
  | "session_declined"
  | "sprint_reply"
  | "sprint_proposed"
  | "module_ready"
  | "report_feedback_request"
  | "pilot_testimonial_request"
  | "session_request_confirmation";

export interface NotificationPreferences {
  reportReady: boolean;
  reAuditReminder: boolean;
  evidenceIncomplete: boolean;
  sessionDeclined: boolean;
  sprintReply: boolean;
  sprintProposed: boolean;
  moduleReady: boolean;
  reportFeedbackRequest: boolean;
  pilotTestimonialRequest: boolean;
  sessionRequestConfirmation: boolean;
  /** Master opt-out, set only via the real /unsubscribe flow's "unsubscribe
   *  from everything" option — checked before any per-type key. Also
   *  shown (and re-toggleable) in Account Settings, so a client isn't
   *  permanently stuck once they've opted out via email. */
  optedOutOfAll: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  reportReady: true,
  reAuditReminder: true,
  evidenceIncomplete: true,
  sessionDeclined: true,
  sprintReply: true,
  sprintProposed: true,
  moduleReady: true,
  reportFeedbackRequest: true,
  pilotTestimonialRequest: true,
  sessionRequestConfirmation: true,
  optedOutOfAll: false,
};

/** event_type (the DB/dispatch string) -> the NotificationPreferences key it's gated by. */
export const EVENT_TYPE_TO_PREFERENCE_KEY: Record<ClientNotificationEventType, keyof NotificationPreferences> = {
  report_ready: "reportReady",
  re_audit_reminder: "reAuditReminder",
  evidence_incomplete: "evidenceIncomplete",
  session_declined: "sessionDeclined",
  sprint_reply: "sprintReply",
  sprint_proposed: "sprintProposed",
  module_ready: "moduleReady",
  report_feedback_request: "reportFeedbackRequest",
  pilot_testimonial_request: "pilotTestimonialRequest",
  session_request_confirmation: "sessionRequestConfirmation",
};

/**
 * Human-readable noun-phrase label per preference key — shared verbatim
 * between Account Settings ("Email me: {label}") and the /unsubscribe
 * confirm page ("Unsubscribe from {label}"), so the two surfaces
 * describe the same toggle identically and can't drift.
 */
export const PREFERENCE_LABELS: Record<keyof NotificationPreferences, string> = {
  reportReady: "report-ready notifications",
  reAuditReminder: "re-audit reminders",
  evidenceIncomplete: "evidence-submission reminders",
  sessionDeclined: "session request updates",
  sprintReply: "Execution Sprint reply notifications",
  sprintProposed: "Execution Sprint proposal notifications",
  moduleReady: "module-results notifications",
  reportFeedbackRequest: "post-delivery feedback requests",
  pilotTestimonialRequest: "testimonial/referral requests",
  sessionRequestConfirmation: "session-request confirmations",
  optedOutOfAll: "all Elvanis emails",
};

/** Ordered, excluding optedOutOfAll — Account Settings renders one checkbox per key in this order, then a separate master toggle. */
export const PER_TYPE_PREFERENCE_KEYS: (keyof Omit<NotificationPreferences, "optedOutOfAll">)[] = [
  "reportReady",
  "reAuditReminder",
  "evidenceIncomplete",
  "sessionDeclined",
  "sprintProposed",
  "sprintReply",
  "moduleReady",
  "reportFeedbackRequest",
  "pilotTestimonialRequest",
  "sessionRequestConfirmation",
];

export function isOptedOut(preferences: Partial<NotificationPreferences> | null | undefined, key: keyof NotificationPreferences): boolean {
  if (!preferences) return false;
  if (preferences.optedOutOfAll === true) return true;
  return preferences[key] === false;
}
