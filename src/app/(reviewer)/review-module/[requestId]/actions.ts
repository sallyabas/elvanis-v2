"use server";

import { revalidatePath } from "next/cache";
import {
  acceptModuleFinding,
  editModuleFinding,
  rejectModuleFinding,
  approveModuleRequest,
  acceptProcurementAnswer,
  editProcurementAnswer,
  rejectProcurementAnswer,
} from "@/lib/reviewer/module-workspace";
import { generateAndPersistProcurementAnswers } from "@/lib/modules/tender-readiness/procurement-answers";
import { createClient } from "@/lib/supabase/server";

// Same reviewer-session-check pattern as (reviewer)/review/[reportId]/actions.ts
// — Server Actions are independently reachable POST endpoints, not
// protected by the page-level layout gate alone.
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

export async function acceptModuleFindingAction(requestId: string, findingId: string, notes?: string) {
  await getReviewerId();
  await acceptModuleFinding(findingId, notes);
  revalidatePath(`/review-module/${requestId}`);
}

export async function editModuleFindingAction(requestId: string, findingId: string, editedContent: Record<string, unknown>, notes?: string) {
  await getReviewerId();
  await editModuleFinding(findingId, editedContent, notes);
  revalidatePath(`/review-module/${requestId}`);
}

export async function rejectModuleFindingAction(requestId: string, findingId: string, notes?: string) {
  await getReviewerId();
  await rejectModuleFinding(findingId, notes);
  revalidatePath(`/review-module/${requestId}`);
}

export async function approveModuleRequestAction(requestId: string) {
  const result = await approveModuleRequest(requestId, await getReviewerId());
  revalidatePath(`/review-module/${requestId}`);
  revalidatePath("/queue");
  return result;
}

export async function generateProcurementAnswersAction(requestId: string) {
  await getReviewerId();
  try {
    await generateAndPersistProcurementAnswers(requestId);
    revalidatePath(`/review-module/${requestId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function acceptProcurementAnswerAction(requestId: string, answerId: string, notes?: string) {
  await getReviewerId();
  await acceptProcurementAnswer(answerId, notes);
  revalidatePath(`/review-module/${requestId}`);
}

export async function editProcurementAnswerAction(requestId: string, answerId: string, editedAnswer: string, notes?: string) {
  await getReviewerId();
  await editProcurementAnswer(answerId, editedAnswer, notes);
  revalidatePath(`/review-module/${requestId}`);
}

export async function rejectProcurementAnswerAction(requestId: string, answerId: string, notes?: string) {
  await getReviewerId();
  await rejectProcurementAnswer(answerId, notes);
  revalidatePath(`/review-module/${requestId}`);
}
