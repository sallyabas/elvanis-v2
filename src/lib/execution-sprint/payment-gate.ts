import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runSprintTaskDraftingAfterPayment } from "./workspace";

/**
 * Execution Sprint payment gate (confirmed 2026-09-07, unified flow spec)
 * — same shape as module-payment-gate.ts, deliberately: `payment_status`
 * (not `execution_sprints.status`) carries the real atomic lock, since
 * `status` must stay at 'awaiting_payment' throughout the real Groq
 * task-drafting call — flipping it to 'scoped' before tasks exist would
 * make a genuinely-failed draft indistinguishable from a genuinely-empty
 * one.
 */

export interface SprintPaymentActionResult {
  success: boolean;
  error?: string;
}

interface ClaimedSprint {
  claimed: true;
}
interface UnclaimedSprint {
  claimed: false;
  error: string;
}

async function claimSprintForTaskDrafting(supabase: SupabaseClient, sprintId: string): Promise<ClaimedSprint | UnclaimedSprint> {
  const { data: row, error: loadError } = await supabase
    .from("execution_sprints")
    .select("id, status, payment_status, selected_finding_id")
    .eq("id", sprintId)
    .maybeSingle();
  if (loadError) return { claimed: false, error: `Could not load this sprint: ${loadError.message}` };
  if (!row) return { claimed: false, error: "This sprint no longer exists." };
  if (row.status !== "awaiting_payment") {
    return { claimed: false, error: "This sprint is no longer awaiting payment — it may have already been processed." };
  }
  if (!row.selected_finding_id) {
    return { claimed: false, error: "No finding has been chosen for this sprint yet — pick one before marking it paid." };
  }
  if (row.payment_status !== "pending" && row.payment_status !== "unpaid") {
    return { claimed: false, error: "This sprint is already being processed — no duplicate task drafting was run." };
  }

  const { data: claimedRow, error: claimError } = await supabase
    .from("execution_sprints")
    .update({ payment_status: "processing" })
    .eq("id", sprintId)
    .eq("status", "awaiting_payment")
    .in("payment_status", ["pending", "unpaid"])
    .select("id")
    .maybeSingle();
  if (claimError) return { claimed: false, error: `Could not claim this sprint: ${claimError.message}` };
  if (!claimedRow) {
    return { claimed: false, error: "This sprint was already claimed by another action just now — no duplicate task drafting was run." };
  }

  return { claimed: true };
}

async function revertSprintClaimOnFailure(supabase: SupabaseClient, sprintId: string): Promise<void> {
  const { error } = await supabase.from("execution_sprints").update({ payment_status: "pending" }).eq("id", sprintId).eq("payment_status", "processing");
  if (error) throw new Error(`revertSprintClaimOnFailure failed: ${error.message}`);
}

async function loadSprintOwner(supabase: SupabaseClient, sprintId: string): Promise<string | null> {
  const { data } = await supabase.from("execution_sprints").select("companies(user_id)").eq("id", sprintId).maybeSingle();
  const owner = data?.companies as unknown as { user_id: string } | null;
  return owner?.user_id ?? null;
}

/** The reviewer's "Mark as unpaid" action — mirrors markModuleUnpaid()'s own concurrency-safe scoping (payment_status must still be 'pending', not 'processing'). */
export async function markSprintUnpaid(sprintId: string): Promise<SprintPaymentActionResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("execution_sprints")
    .update({ payment_status: "unpaid" })
    .eq("id", sprintId)
    .eq("status", "awaiting_payment")
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This sprint is no longer awaiting payment, or is already being processed." };

  const recipientId = await loadSprintOwner(supabase, sprintId);
  if (recipientId) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: recipientId,
      event_type: "sprint_unpaid",
      channel: "email",
      related_sprint_id: sprintId,
      sent_at: null,
    });
    if (notifError) throw new Error(`markSprintUnpaid: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}

/** The reviewer's "Mark as paid" action — claims, runs the real task-drafting call, and (on success) leaves the sprint at 'scoped', ready for the existing mandatory Accept/Edit/Reject/Approve pass. */
export async function markSprintPaidAndDraftTasks(sprintId: string): Promise<SprintPaymentActionResult> {
  const supabase = createAdminClient();
  const claim = await claimSprintForTaskDrafting(supabase, sprintId);
  if (!claim.claimed) return { success: false, error: claim.error };

  try {
    await runSprintTaskDraftingAfterPayment(sprintId);
    const { error: updateError } = await supabase.from("execution_sprints").update({ payment_status: "paid" }).eq("id", sprintId).eq("payment_status", "processing");
    if (updateError) throw new Error(updateError.message);

    const recipientReviewers = await supabase.from("users").select("id").eq("role", "reviewer");
    if ((recipientReviewers.data ?? []).length > 0) {
      await supabase.from("notifications").insert(
        (recipientReviewers.data ?? []).map((reviewer) => ({
          recipient_type: "reviewer",
          recipient_id: reviewer.id,
          event_type: "sprint_tasks_ready_for_review",
          channel: "email",
          related_sprint_id: sprintId,
          sent_at: null,
        })),
      );
    }

    return { success: true };
  } catch (e) {
    await revertSprintClaimOnFailure(supabase, sprintId);
    return {
      success: false,
      error: `Marked the claim, but drafting the plan failed: ${e instanceof Error ? e.message : "unknown error"}. Payment status was reverted to 'pending' — you can try marking it paid again.`,
    };
  }
}

/**
 * 'Canceled' status (confirmed 2026-09-07, unified flow spec) — only
 * reachable from 'awaiting_payment' (a sprint already scoped/in-progress
 * goes through the normal reviewer/client flows instead).
 */
export async function cancelSprintRequest(sprintId: string, reason: string): Promise<SprintPaymentActionResult> {
  if (!reason.trim()) return { success: false, error: "A cancellation reason is required." };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("execution_sprints")
    .update({ status: "canceled", cancellation_reason: reason.trim() })
    .eq("id", sprintId)
    .eq("status", "awaiting_payment")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This sprint is no longer awaiting payment — it may already be past cancellation." };

  const recipientId = await loadSprintOwner(supabase, sprintId);
  if (recipientId) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: recipientId,
      event_type: "sprint_canceled",
      channel: "email",
      related_sprint_id: sprintId,
      sent_at: null,
    });
    if (notifError) throw new Error(`cancelSprintRequest: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}
