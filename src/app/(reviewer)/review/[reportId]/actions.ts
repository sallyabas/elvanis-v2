"use server";

import { revalidatePath } from "next/cache";
import {
  acceptFinding,
  editFinding,
  rejectFinding,
  resolveConflict,
  resolveDispute,
  reRankTop3,
  approveReport,
  deliverReport,
  type DisputeResolution,
} from "@/lib/reviewer/workspace";
import type { LensFinding } from "@/lib/lenses/types";
import { createClient } from "@/lib/supabase/server";
import { rerunAudit } from "@/lib/audit/rerun-audit";
import { setPlanTier, type PlanTier } from "@/lib/service-layer/plan-tier";

// reviewed_by is a real FK to users.id. Now sourced from the real
// authenticated session (confirmed 2026-08-02), not a REVIEWER_USER_ID env
// var stand-in. The (reviewer) layout already gates page rendering, but
// Server Actions are independently reachable POST endpoints — layout
// gating alone does not protect them, so this re-checks session + role
// itself rather than trusting the caller got here through the gated page.
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

export async function acceptFindingAction(reportId: string, findingId: string, notes?: string) {
  await getReviewerId();
  await acceptFinding(findingId, notes);
  revalidatePath(`/review/${reportId}`);
}

export async function editFindingAction(
  reportId: string,
  findingId: string,
  original: LensFinding,
  changes: Partial<Pick<LensFinding, "title" | "diagnosis" | "rootCause" | "recommendedAction" | "severity" | "confidenceLevel" | "goalRelevance">>,
  notes?: string,
) {
  await getReviewerId();
  const edited: LensFinding = { ...original, ...changes };
  await editFinding(findingId, edited, notes);
  revalidatePath(`/review/${reportId}`);
}

export async function rejectFindingAction(reportId: string, findingId: string, notes?: string) {
  await getReviewerId();
  await rejectFinding(findingId, notes);
  revalidatePath(`/review/${reportId}`);
}

export async function resolveConflictAction(reportId: string, conflictId: string, notes: string) {
  await getReviewerId();
  await resolveConflict(conflictId, notes);
  revalidatePath(`/review/${reportId}`);
}

export async function resolveDisputeAction(
  reportId: string,
  findingId: string,
  resolution: DisputeResolution,
  notes: string,
  original?: LensFinding,
  editedFields?: Partial<Pick<LensFinding, "title" | "diagnosis" | "rootCause" | "recommendedAction" | "severity" | "confidenceLevel" | "goalRelevance">>,
) {
  await getReviewerId();
  const editedContent = resolution === "edit" && original && editedFields ? { ...original, ...editedFields } : undefined;
  await resolveDispute(findingId, resolution, notes, editedContent);
  revalidatePath(`/review/${reportId}`);
}

export async function reRankTop3Action(reportId: string, orderedFindingIds: string[]) {
  await getReviewerId();
  await reRankTop3(reportId, orderedFindingIds);
  revalidatePath(`/review/${reportId}`);
}

export async function approveReportAction(reportId: string) {
  const result = await approveReport(reportId, await getReviewerId());
  revalidatePath(`/review/${reportId}`);
  revalidatePath("/queue");
  return result;
}

/**
 * Real "Deliver" button (confirmed 2026-08-06) — closes a gap flagged
 * repeatedly across multiple live end-to-end passes: deliverReport()
 * existed in workspace.ts with no UI caller anywhere, forcing every full
 * walkthrough (including the test-as-a-stranger pass) to route around it
 * with a direct script call. deliverReport() itself already enforces
 * status === 'approved' — this action just surfaces that as a real button
 * and re-checks reviewer session/role first, same pattern as every other
 * action in this file.
 */
export async function deliverReportAction(reportId: string) {
  await getReviewerId();
  try {
    await deliverReport(reportId);
    revalidatePath(`/review/${reportId}`);
    revalidatePath("/queue");
    revalidatePath("/reports");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Basic re-run/refresh button (confirmed 2026-08-05) — reviewer-triggered,
 * see rerun-audit.ts docblock for why this isn't a client self-serve
 * button yet. Produces a brand-new report in pending_review; the mandatory
 * review gate applies to it exactly as it does to any other report.
 */
export async function rerunAuditAction(reportId: string) {
  await getReviewerId();
  try {
    const result = await rerunAudit(reportId);
    revalidatePath("/queue");
    return { success: true, newReportId: result.reportId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Concierge tier assignment (confirmed 2026-08-06) — closes the "no tier
 * badge in the Reviewer Workspace yet" gap flagged in CLAUDE.md 2026-08-02.
 */
export async function setPlanTierAction(reportId: string, companyUserId: string, tier: PlanTier) {
  await getReviewerId();
  await setPlanTier(companyUserId, tier);
  revalidatePath(`/review/${reportId}`);
}
