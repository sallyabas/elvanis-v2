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

export type SessionType = "discovery" | "delivery" | "f2f_workshop";

export interface RequestSessionResult {
  success: boolean;
  error?: string;
}

/**
 * Client-facing — session-scoped, RLS-respecting, verifies the caller owns
 * the company before writing (same discipline as every other client-owned
 * write in this codebase).
 */
export async function requestSession(companyId: string, sessionType: SessionType, clientNotes: string | null): Promise<RequestSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", user.id).single();
  if (companyError || !company) return { success: false, error: "Company not found." };

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

export async function updateSessionRequestStatus(
  requestId: string,
  status: "scheduled" | "completed" | "declined",
  reviewerNotes?: string,
): Promise<void> {
  const admin = createAdminClient();
  const update: Record<string, unknown> = { status, reviewer_notes: reviewerNotes ?? null };
  if (status === "scheduled") update.scheduled_at = new Date().toISOString();
  if (status === "completed") update.completed_at = new Date().toISOString();

  const { error } = await admin.from("session_requests").update(update).eq("id", requestId);
  if (error) throw new Error(`updateSessionRequestStatus: ${error.message}`);
}
