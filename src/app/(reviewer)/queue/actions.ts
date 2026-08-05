"use server";

import { revalidatePath } from "next/cache";
import { markRegulatoryContentReviewed } from "@/lib/reviewer/regulatory-content-review";
import { updateSessionRequestStatus } from "@/lib/service-layer/session-requests";
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
