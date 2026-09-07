"use server";

import { revalidatePath } from "next/cache";
import { updateSessionRequestStatus } from "@/lib/service-layer/session-requests";
import { updatePricingItem } from "@/lib/pricing";
import { replyToSprintQueueItem } from "@/lib/execution-sprint/workspace";
import { resolveSprintInterestRequest } from "@/lib/execution-sprint/interest-requests";
import { resolveContactRequest } from "@/lib/reviewer/contact-requests";
import { markReaduitPaid, markReaduitUnpaid, cancelReaudit } from "@/lib/reviewer/reaudit-payment";
import { markModulePaidAndRunAnalysis, markModuleUnpaid, cancelModuleRequest } from "@/lib/reviewer/module-payment-gate";
import { markSprintPaidAndDraftTasks, markSprintUnpaid, cancelSprintRequest } from "@/lib/execution-sprint/payment-gate";
import { createClient } from "@/lib/supabase/server";

// Same independent session+role re-check as every other reviewer Server
// Action (review/[reportId]/actions.ts, review-module/[requestId]/actions.ts)
// — the (reviewer) layout gates page rendering, not these directly
// reachable POST endpoints.
async function getReviewerId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "reviewer") throw new Error("Not authorized as a reviewer.");

  return user.id;
}

/**
 * Real workflow (confirmed 2026-08-11, live testing pass) — replaces the
 * previous single bound-arg version, which had no way to pass a real
 * scheduled date/time or reviewer notes at all. FormData, not bound args,
 * since each action now carries real user-entered values (a date/time, a
 * decline reason, a completion outcome), not just a fixed identifier.
 */
export async function scheduleSessionRequestAction(formData: FormData) {
  await getReviewerId();
  const requestId = String(formData.get("requestId"));
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!requestId || !scheduledAt) throw new Error("A date/time is required to schedule.");
  await updateSessionRequestStatus(requestId, "scheduled", { scheduledAt, reviewerNotes: notes || undefined });
  revalidatePath("/queue");
}

export async function completeSessionRequestAction(formData: FormData) {
  await getReviewerId();
  const requestId = String(formData.get("requestId"));
  const notes = String(formData.get("notes") ?? "").trim();
  if (!requestId) throw new Error("Missing request id.");
  await updateSessionRequestStatus(requestId, "completed", { reviewerNotes: notes || undefined });
  revalidatePath("/queue");
}

export async function declineSessionRequestAction(formData: FormData) {
  await getReviewerId();
  const requestId = String(formData.get("requestId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!requestId || !reason) throw new Error("A reason is required to decline.");
  await updateSessionRequestStatus(requestId, "declined", { reviewerNotes: reason });
  revalidatePath("/queue");
}

/**
 * Pricing panel (confirmed 2026-08-06) — reviewer-facing, since no
 * separate admin role/auth exists in this codebase (same reasoning
 * already applied to the plan-tier badge and the regulatory-content
 * "Mark reviewed" buttons: the reviewer role is the de facto admin for
 * internal operational data, not a new system to build). Uses FormData
 * (not a bound arg) since the price itself is a live-edited value, not a
 * fixed identifier.
 */
export async function updatePricingItemAction(formData: FormData) {
  await getReviewerId();
  const itemKey = String(formData.get("itemKey"));
  const priceAmount = Number(formData.get("priceAmount"));
  if (!itemKey || Number.isNaN(priceAmount) || priceAmount < 0) {
    throw new Error("Invalid pricing update.");
  }
  await updatePricingItem(itemKey, priceAmount);
  revalidatePath("/queue");
}

/**
 * Execution Sprint queue items — both client change-request notes and
 * deterministic KPI-deviation alerts land here (confirmed 2026-08-06, "same
 * mechanism as the plan-change notes, different trigger"). Replying sends
 * the client a real email immediately, not on the next cron tick — see
 * replyToSprintQueueItem's own docblock for why this is the one deliberate
 * exception to the standard dispatch-on-cron pattern.
 */
export async function replyToSprintQueueItemAction(formData: FormData) {
  const reviewerId = await getReviewerId();
  const queueItemId = String(formData.get("queueItemId"));
  const replyText = String(formData.get("replyText") ?? "").trim();
  if (!queueItemId || !replyText) throw new Error("Reply text is required.");
  await replyToSprintQueueItem(queueItemId, replyText, reviewerId);
  revalidatePath("/queue");
}

/**
 * Client-facing Execution Sprint interest (confirmed 2026-08-06, honest UX
 * review pass) — dismissing/acknowledging a request. Doesn't create the
 * sprint itself; the reviewer still starts it from the report workspace's
 * existing "Start an Execution Sprint" entry point, this only clears the
 * request off the queue once seen.
 */
export async function resolveSprintInterestRequestAction(requestId: string) {
  const reviewerId = await getReviewerId();
  await resolveSprintInterestRequest(requestId, reviewerId);
  revalidatePath("/queue");
}

/** "Having trouble? Contact us" (confirmed 2026-09-05) — marking a request resolved once the reviewer has followed up. */
export async function resolveContactRequestAction(id: string) {
  await getReviewerId();
  await resolveContactRequest(id);
  revalidatePath("/queue");
}

/**
 * Re-audit payment gate (confirmed 2026-09-06) — the reviewer's own
 * "Mark as paid" action, the one thing that moves an awaiting-payment
 * re-audit forward (see reaudit-payment.ts's markReaduitPaid() for the
 * real atomic-claim-and-run logic; this is just the session+role-checked
 * wrapper, same pattern as every other action in this file). Throws on a
 * real failure rather than silently no-opping — same plain-form
 * convention already used on this page, where an action's own exception
 * is the error-surfacing mechanism.
 */
export async function markReaduitPaidAction(pendingSubmissionId: string) {
  await getReviewerId();
  const result = await markReaduitPaid(pendingSubmissionId);
  if (!result.success) throw new Error(result.error ?? "Failed to mark as paid.");
  revalidatePath("/queue");
}

/**
 * Module payment gate (confirmed 2026-09-06, direct founder decision) —
 * the reviewer's own "Mark as paid" action for the three standalone
 * modules. Runs the real, synchronous Groq call inline (see
 * module-payment-gate.ts's own docblock for why there's no cron to
 * hand this off to) — same independent session+role re-check as every
 * other reviewer Server Action in this file.
 */
export async function markModulePaidAction(requestId: string) {
  await getReviewerId();
  const result = await markModulePaidAndRunAnalysis(requestId);
  if (!result.success) throw new Error(result.error ?? "Failed to mark as paid.");
  revalidatePath("/queue");
}

/**
 * Unified flow (confirmed 2026-09-07) — the reviewer's "Mark as unpaid"
 * action for re-audits, mirroring markModulePaidAction/markModuleUnpaidAction
 * above.
 */
export async function markReaduitUnpaidAction(pendingSubmissionId: string) {
  await getReviewerId();
  const result = await markReaduitUnpaid(pendingSubmissionId);
  if (!result.success) throw new Error(result.error ?? "Failed to mark as unpaid.");
  revalidatePath("/queue");
}

/**
 * 'Canceled' status (confirmed 2026-09-07, unified flow spec) — FormData,
 * not a bound arg, since this carries a real, required reason (same
 * pattern as declineSessionRequestAction below).
 */
export async function cancelReaduitAction(formData: FormData) {
  await getReviewerId();
  const pendingSubmissionId = String(formData.get("pendingSubmissionId"));
  const reason = String(formData.get("reason") ?? "");
  const result = await cancelReaudit(pendingSubmissionId, reason);
  if (!result.success) throw new Error(result.error ?? "Failed to cancel.");
  revalidatePath("/queue");
}

export async function cancelModuleRequestAction(formData: FormData) {
  await getReviewerId();
  const requestId = String(formData.get("requestId"));
  const reason = String(formData.get("reason") ?? "");
  const result = await cancelModuleRequest(requestId, reason);
  if (!result.success) throw new Error(result.error ?? "Failed to cancel.");
  revalidatePath("/queue");
}

/**
 * Execution Sprint payment gate (confirmed 2026-09-07, unified flow spec)
 * — mirrors markModulePaidAction/markModuleUnpaidAction above.
 */
export async function markSprintPaidAction(sprintId: string) {
  await getReviewerId();
  const result = await markSprintPaidAndDraftTasks(sprintId);
  if (!result.success) throw new Error(result.error ?? "Failed to mark as paid.");
  revalidatePath("/queue");
}

export async function markSprintUnpaidAction(sprintId: string) {
  await getReviewerId();
  const result = await markSprintUnpaid(sprintId);
  if (!result.success) throw new Error(result.error ?? "Failed to mark as unpaid.");
  revalidatePath("/queue");
}

export async function cancelSprintRequestAction(formData: FormData) {
  await getReviewerId();
  const sprintId = String(formData.get("sprintId"));
  const reason = String(formData.get("reason") ?? "");
  const result = await cancelSprintRequest(sprintId, reason);
  if (!result.success) throw new Error(result.error ?? "Failed to cancel.");
  revalidatePath("/queue");
}

export async function markModuleUnpaidAction(requestId: string) {
  await getReviewerId();
  const result = await markModuleUnpaid(requestId);
  if (!result.success) throw new Error(result.error ?? "Failed to mark as unpaid.");
  revalidatePath("/queue");
}
