"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  acceptSprintTask,
  editSprintTask,
  rejectSprintTask,
  approveSprintTasks,
  addSprintReviewerCommentary,
  type SprintTaskEdit,
} from "@/lib/execution-sprint/workspace";

// Same independent session+role re-check as every other reviewer Server
// Action in this codebase — the (reviewer) layout gates page rendering,
// not these directly reachable POST endpoints.
async function requireReviewer(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "reviewer") throw new Error("Not authorized as a reviewer.");
}

export async function acceptSprintTaskAction(sprintId: string, taskId: string) {
  await requireReviewer();
  await acceptSprintTask(taskId);
  revalidatePath(`/review-sprint/${sprintId}`);
}

export async function editSprintTaskAction(sprintId: string, taskId: string, edits: SprintTaskEdit) {
  await requireReviewer();
  await editSprintTask(taskId, edits);
  revalidatePath(`/review-sprint/${sprintId}`);
}

export async function rejectSprintTaskAction(sprintId: string, taskId: string) {
  await requireReviewer();
  await rejectSprintTask(taskId);
  revalidatePath(`/review-sprint/${sprintId}`);
}

export async function approveSprintTasksAction(sprintId: string) {
  await requireReviewer();
  const result = await approveSprintTasks(sprintId);
  revalidatePath(`/review-sprint/${sprintId}`);
  revalidatePath("/queue");
  return result;
}

export async function addSprintReviewerCommentaryAction(sprintId: string, commentary: string) {
  await requireReviewer();
  await addSprintReviewerCommentary(sprintId, commentary);
  revalidatePath(`/review-sprint/${sprintId}`);
}
