"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markFrameworkReviewed, updateRegulatoryFramework } from "@/lib/reviewer/regulatory-frameworks";

// Same independent session+role re-check as every other reviewer Server
// Action in this codebase — the (reviewer) layout gates page rendering,
// not these directly reachable POST endpoints. Returns the reviewer's own
// display name (falls back to their email) for markFrameworkReviewedAction
// to stamp as last_reviewed_by.
async function requireReviewer(): Promise<{ id: string; name: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("users").select("role, name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "reviewer") throw new Error("Not authorized as a reviewer.");
  return { id: user.id, name: (profile.name as string | null) ?? user.email ?? "Reviewer" };
}

export async function markFrameworkReviewedAction(id: string, formData: FormData): Promise<{ nextReviewDueDays: number }> {
  const reviewer = await requireReviewer();
  const reviewNotes = String(formData.get("reviewNotes") ?? "").trim() || null;
  await markFrameworkReviewed(id, reviewer.name, reviewNotes);
  revalidatePath("/admin/regulatory-frameworks");
  revalidatePath("/queue");

  // The brief's own specified confirmation copy needs "next review due in
  // [X] days" — that's just the framework's own threshold, since
  // last_reviewed_at was just set to now. Re-read it rather than trust a
  // value the caller might have gone stale on.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin.from("regulatory_frameworks").select("staleness_threshold_days").eq("id", id).single();
  return { nextReviewDueDays: (data?.staleness_threshold_days as number | undefined) ?? 90 };
}

export async function updateRegulatoryFrameworkAction(id: string, formData: FormData) {
  await requireReviewer();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const thresholdRaw = String(formData.get("stalenessThresholdDays") ?? "");
  const threshold = Number(thresholdRaw);
  await updateRegulatoryFramework(id, {
    sourceUrl: sourceUrl || null,
    stalenessThresholdDays: Number.isFinite(threshold) && threshold > 0 ? threshold : undefined,
  });
  revalidatePath("/admin/regulatory-frameworks");
}
