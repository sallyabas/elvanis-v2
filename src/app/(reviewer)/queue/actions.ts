"use server";

import { revalidatePath } from "next/cache";
import { markRegulatoryContentReviewed } from "@/lib/reviewer/regulatory-content-review";
import { updateSessionRequestStatus } from "@/lib/service-layer/session-requests";
import { updatePricingItem } from "@/lib/pricing";
import { replyToSprintQueueItem } from "@/lib/execution-sprint/workspace";
import { resolveSprintInterestRequest } from "@/lib/execution-sprint/interest-requests";
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

export async function markRegulatoryContentReviewedAction(jurisdiction: string) {
  const reviewerId = await getReviewerId();
  await markRegulatoryContentReviewed(jurisdiction, reviewerId);
  revalidatePath("/queue");
}

export async function updateSessionRequestStatusAction(requestId: string, status: "scheduled" | "completed" | "declined") {
  await getReviewerId();
  await updateSessionRequestStatus(requestId, status);
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
