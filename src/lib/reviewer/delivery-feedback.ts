"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Automated post-delivery feedback + pilot testimonial/referral asks
 * (confirmed 2026-08-24, direct founder request, correcting the earlier
 * "handle referrals manually" decision from the same day's Concierge
 * batch). Client submission is session-scoped (ownership verified before
 * insert, same discipline as every other client-owned write in this
 * codebase); the reviewer-facing list uses the admin client, same pattern
 * as every other reviewer queue read.
 */

export type FeedbackType = "general" | "testimonial";

export interface SubmitDeliveryFeedbackInput {
  companyId: string;
  feedbackType: FeedbackType;
  relatedReportId?: string | null;
  relatedModuleRequestId?: string | null;
  responseText: string;
  /** Testimonial/referral only — a name/email for a referral, distinct from the testimonial text itself. */
  referralContact?: string | null;
}

export interface SubmitDeliveryFeedbackResult {
  success: boolean;
  error?: string;
}

export async function submitDeliveryFeedback(input: SubmitDeliveryFeedbackInput): Promise<SubmitDeliveryFeedbackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", input.companyId).eq("user_id", user.id).maybeSingle();
  if (companyError || !company) return { success: false, error: "Company not found." };

  const trimmedResponse = input.responseText.trim();
  const trimmedContact = input.referralContact?.trim() || null;
  if (trimmedResponse.length === 0 && !trimmedContact) return { success: false, error: "Enter a response before submitting." };

  const { error: insertError } = await supabase.from("delivery_feedback").insert({
    company_id: input.companyId,
    feedback_type: input.feedbackType,
    related_report_id: input.relatedReportId ?? null,
    related_module_request_id: input.relatedModuleRequestId ?? null,
    response_text: trimmedResponse || null,
    referral_contact: trimmedContact,
  });
  if (insertError) return { success: false, error: `Couldn't submit: ${insertError.message}` };

  return { success: true };
}

export interface DeliveryFeedbackRow {
  id: string;
  companyName: string;
  feedbackType: FeedbackType;
  responseText: string | null;
  referralContact: string | null;
  createdAt: string;
}

/** Reviewer-facing — every real response, newest first, for /queue's "Client feedback" panel. */
export async function listDeliveryFeedback(): Promise<DeliveryFeedbackRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("delivery_feedback")
    .select("id, feedback_type, response_text, referral_contact, created_at, companies(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listDeliveryFeedback: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    companyName: (row.companies as unknown as { name: string } | null)?.name ?? "Unknown company",
    feedbackType: row.feedback_type as FeedbackType,
    responseText: row.response_text as string | null,
    referralContact: row.referral_contact as string | null,
    createdAt: row.created_at as string,
  }));
}

/**
 * Whether THIS company has already responded to a specific delivery —
 * gates the banner vs. a thank-you state.
 *
 * Real bug found and fixed live (confirmed 2026-08-24): `delivery_feedback`
 * only has an INSERT policy (the client's own submission write) — no
 * SELECT policy was ever added. With RLS enabled and no matching SELECT
 * policy, a session-scoped read silently returns zero rows regardless of
 * real data, so this always reported "not yet submitted" even right after
 * a real, confirmed submission. Caught live: submitted real feedback,
 * confirmed the row via a direct DB read, then reloaded the page and saw
 * the ask again instead of the thanks state. Fixed with the admin client
 * — same fix already applied this session for finding-notes.ts's own read
 * path, for the same underlying reason — since the calling page (the
 * client Report page, the module detail page) already verifies company
 * ownership via its own session-scoped query before this function is ever
 * invoked.
 */
export async function hasSubmittedFeedbackFor(companyId: string, opts: { reportId?: string; moduleRequestId?: string }): Promise<{ general: boolean; testimonial: boolean }> {
  const admin = createAdminClient();
  let query = admin.from("delivery_feedback").select("feedback_type").eq("company_id", companyId);
  query = opts.reportId ? query.eq("related_report_id", opts.reportId) : query.eq("related_module_request_id", opts.moduleRequestId as string);
  const { data } = await query;
  const types = new Set((data ?? []).map((r) => r.feedback_type as FeedbackType));
  return { general: types.has("general"), testimonial: types.has("testimonial") };
}
