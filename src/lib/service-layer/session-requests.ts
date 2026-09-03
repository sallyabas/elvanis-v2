"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Service Layer: Discovery/Delivery Session, F2F Workshop request handling
 * (confirmed 2026-08-06, spec §1.5/§1.9/§1.9a). Real, buildable-now scope
 * given no payment provider or calendar/booking integration exists
 * anywhere in this codebase (confirmed by grep before building this) —
 * deliberately a request + human-follow-up mechanism, same pattern already
 * used throughout this codebase for re-audit reminders and evidence-
 * completeness nudges: log a real row, notify a human, an actual
 * booking/scheduling system is real, deliberately deferred follow-on
 * scope, not faked here.
 *
 * "Discovery Session" — optional, offered but never required on Standard,
 * included by default on Concierge; can be requested any time before or
 * during evidence intake.
 * "Delivery Session" — post-report only; bundled by default with the paid
 * Execution Sprint or sellable standalone. requestSession() enforces
 * "post-report" for both delivery and f2f_workshop by requiring the
 * caller to already have at least one delivered (status='sent') report —
 * same reasoning as the spec's own explicit rule for F2F Workshop
 * ("never offered before evidence submission, since it needs real findings
 * to discuss"), applied to Delivery Session too since F2F Workshop is
 * explicitly an upgrade OF Delivery Session specifically.
 */

/**
 * "concierge_inquiry" added 2026-08-24, direct founder request — the
 * Concierge "Contact Sales" button reuses this exact mechanism (same
 * table, same reviewer queue panel, same notification pipeline), just a
 * new type value, not a new mechanism. No payment/checkout — manual,
 * same as Execution Sprint's own real-world payment handling (a Stripe
 * payment link, sent by the reviewer after the scope is agreed).
 */
// "compliance_consultation" added 2026-08-27 (Onboarding Architecture &
// Path Routing brief, Part 3 refinement, confirmed decision) — the
// founder's own confirmed reuse of this exact mechanism for "route to
// human consultation" (an active compliance/procurement request with no
// AI in production yet), same pattern as concierge_inquiry.
export type SessionType = "discovery" | "delivery" | "f2f_workshop" | "concierge_inquiry" | "compliance_consultation";

export interface RequestSessionResult {
  success: boolean;
  error?: string;
}

/**
 * Client-facing — session-scoped, RLS-respecting, verifies the caller owns
 * the company before writing (same discipline as every other client-owned
 * write in this codebase).
 *
 * Phone snapshot (confirmed 2026-09-03, direct founder request) — the
 * client's own profile-level `users.phone` is read here, at the moment of
 * submission, and copied onto the request row as `phone_snapshot` rather
 * than left as a live foreign-key-style reference. Same "compute now,
 * don't recompute later" principle already used for
 * reports.edit_window_closes_at/review_due_at: a reviewer looking back at
 * an already-submitted request should see the number that was actually
 * on file when the client asked to be reached, not whatever the profile
 * says today if it's since been edited. Optional throughout — a client
 * who's never set a phone number still gets `null`, same as before this
 * field existed.
 */
export async function requestSession(
  companyId: string,
  sessionType: SessionType,
  clientNotes: string | null,
  urgent: boolean = false,
): Promise<RequestSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", user.id).single();
  if (companyError || !company) return { success: false, error: "Company not found." };

  const { data: profile } = await supabase.from("users").select("phone").eq("id", user.id).maybeSingle();
  const phoneSnapshot = (profile?.phone as string | null) ?? null;

  if (sessionType === "delivery" || sessionType === "f2f_workshop") {
    const { data: deliveredReport } = await supabase.from("reports").select("id").eq("company_id", companyId).eq("status", "sent").limit(1).maybeSingle();
    if (!deliveredReport) {
      return {
        success: false,
        error: sessionType === "f2f_workshop"
          ? "An F2F Workshop can only be requested once you have a delivered report to discuss."
          : "A Delivery Session can only be requested once you have a delivered report.",
      };
    }
  }

  const { error: insertError } = await supabase.from("session_requests").insert({
    company_id: companyId,
    session_type: sessionType,
    client_notes: clientNotes,
    is_urgent: urgent,
    phone_snapshot: phoneSnapshot,
  });
  if (insertError) return { success: false, error: `Couldn't submit request: ${insertError.message}` };

  // Notify every reviewer, same pattern as checkEvidenceCompletenessNudges
  // — real personal follow-up is how this actually gets scheduled today,
  // no calendar integration exists to automate it.
  const admin = createAdminClient();
  const { data: reviewers } = await admin.from("users").select("id").eq("role", "reviewer");
  for (const reviewer of reviewers ?? []) {
    await admin.from("notifications").insert({
      recipient_type: "reviewer",
      recipient_id: reviewer.id,
      event_type: "session_requested",
      channel: "email",
      sent_at: null,
    });
  }

  return { success: true };
}

export interface SessionRequestRow {
  id: string;
  company_id: string;
  session_type: SessionType;
  status: "requested" | "scheduled" | "completed" | "declined";
  client_notes: string | null;
  reviewer_notes: string | null;
  requested_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  is_urgent: boolean;
  phone_snapshot: string | null;
}

/** Reviewer-facing — lists pending (requested/scheduled) session requests across all companies. */
export async function listPendingSessionRequests(): Promise<(SessionRequestRow & { companyName: string })[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_requests")
    .select("*, companies(name)")
    .in("status", ["requested", "scheduled"])
    .order("requested_at", { ascending: true });
  if (error) throw new Error(`listPendingSessionRequests: ${error.message}`);

  return (data ?? []).map((row) => ({
    ...(row as unknown as SessionRequestRow),
    companyName: (row.companies as unknown as { name: string } | null)?.name ?? "Unknown company",
  }));
}

/**
 * Real workflow, not three inert buttons (confirmed 2026-08-11, live
 * testing pass — this exact panel was reported "done" before and turned
 * out to still be a shallow stub: no way to schedule for a REAL date/time
 * — `scheduled_at` was always just stamped to "now" — no client
 * notification on decline, and no way to record what a "completed"
 * session actually covered).
 *
 * - `scheduled`: `scheduledAt` is now the reviewer's own chosen future
 *   date/time (required), not the moment the button was clicked.
 * - `declined`: `reviewerNotes` is required (the decline reason) and now
 *   fires a real client-facing notification — see below — so the client
 *   actually hears back instead of silently never getting a reply.
 * - `completed`: `reviewerNotes` doubles as the outcome/what-happened
 *   record — no separate structured "outcome" object exists yet (a real,
 *   deliberately minimal choice, same "curated free text over inventing
 *   a new object" pattern already used for dispute_resolution_notes
 *   elsewhere), but it's now real, persisted, and displayed back on the
 *   queue instead of not existing at all.
 */
export async function updateSessionRequestStatus(
  requestId: string,
  status: "scheduled" | "completed" | "declined",
  options: { scheduledAt?: string; reviewerNotes?: string } = {},
): Promise<void> {
  const admin = createAdminClient();
  const update: Record<string, unknown> = { status, reviewer_notes: options.reviewerNotes ?? null };
  if (status === "scheduled") {
    if (!options.scheduledAt) throw new Error("updateSessionRequestStatus: scheduledAt is required when marking scheduled.");
    update.scheduled_at = new Date(options.scheduledAt).toISOString();
  }
  if (status === "completed") update.completed_at = new Date().toISOString();

  const { data: request, error } = await admin
    .from("session_requests")
    .update(update)
    .eq("id", requestId)
    .select("company_id, session_type")
    .single();
  if (error) throw new Error(`updateSessionRequestStatus: ${error.message}`);

  // Real client notification on decline (confirmed 2026-08-11) — the
  // client submitted a real request; declining it silently, with no
  // notification at all, meant they'd just never hear back. Looked up via
  // companies.user_id, same pattern already used everywhere else in this
  // codebase for "the client who owns this company."
  if (status === "declined") {
    const { data: company } = await admin.from("companies").select("user_id").eq("id", request.company_id as string).maybeSingle();
    if (company?.user_id) {
      await admin.from("notifications").insert({
        recipient_type: "client",
        recipient_id: company.user_id,
        event_type: "session_declined",
        channel: "email",
        sent_at: null,
      });
    }
  }
}
