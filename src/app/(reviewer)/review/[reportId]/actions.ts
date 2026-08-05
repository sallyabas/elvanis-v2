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
  type DisputeResolution,
} from "@/lib/reviewer/workspace";
import type { LensFinding } from "@/lib/lenses/types";
import { createClient } from "@/lib/supabase/server";

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
