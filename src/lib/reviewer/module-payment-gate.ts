import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runTenderReadinessAnalysisAfterPayment } from "@/lib/modules/tender-readiness/persist";
import { runAiReliabilityAnalysisAfterPayment } from "@/lib/modules/ai-reliability-audit/persist";
import { runDataProtectionAnalysisAfterPayment } from "@/lib/modules/data-protection-compliance/persist";

/**
 * Module payment gate (confirmed 2026-09-06, direct founder decision) —
 * closes a real, confirmed gap: none of the three paid modules (Tender
 * Readiness, AI Reliability Audit, Data Protection Compliance) had any
 * check of any kind — not payment, not even company-ownership
 * re-verification — before running a real, synchronous Groq call.
 *
 * Deliberately its own file, not folded into module-workspace.ts — that
 * file is the generic Accept/Edit/Reject/Approve/Deliver review
 * MECHANISM shared across all three modules' already-generated findings;
 * this is a genuinely earlier, separate concern (whether the findings get
 * generated AT ALL) that only exists because modules run their real Groq
 * analysis synchronously, with no cron/edit-window seam to piggyback on
 * the way the core audit's own re-audit gate does (see
 * reaudit-payment.ts's own docblock for that contrast).
 *
 * `payment_status` (not `module_requests.status`) is the real atomic lock
 * here, deliberately — unlike the re-audit gate, which can move `status`
 * itself (editing -> audit_in_progress) in the same atomic UPDATE as the
 * claim, a module request's `status` must stay at 'awaiting_payment'
 * throughout the real Groq call: flipping it to 'pending_review' before
 * findings exist would make a genuinely-failed analysis indistinguishable
 * from a genuinely-empty-but-fine one (a request with zero findings is a
 * real, legitimate outcome elsewhere in this codebase, e.g. zero
 * applicable jurisdictions). So `payment_status` carries the full
 * pending/unpaid -> processing -> paid|pending(reverted) lifecycle on its
 * own, and `status` only ever moves once, at the very end, once findings
 * are genuinely persisted.
 */

export interface ModulePaymentActionResult {
  success: boolean;
  error?: string;
}

interface ClaimedModuleRequest {
  claimed: true;
  moduleType: string;
  intakeData: unknown;
}
interface UnclaimedModuleRequest {
  claimed: false;
  error: string;
}

async function claimModuleRequestForAnalysis(
  supabase: SupabaseClient,
  requestId: string,
): Promise<ClaimedModuleRequest | UnclaimedModuleRequest> {
  const { data: row, error: loadError } = await supabase
    .from("module_requests")
    .select("id, module_type, status, payment_status, intake_data")
    .eq("id", requestId)
    .maybeSingle();
  if (loadError) return { claimed: false, error: `Could not load this request: ${loadError.message}` };
  if (!row) return { claimed: false, error: "This request no longer exists." };
  if (row.status !== "awaiting_payment") {
    return { claimed: false, error: "This request is no longer awaiting payment — it may have already been processed." };
  }
  if (row.payment_status !== "pending" && row.payment_status !== "unpaid") {
    return { claimed: false, error: "This request is already being processed — no duplicate analysis was run." };
  }

  // The one real atomic guarantee against a double-click or two reviewers
  // both marking the same request paid: the UPDATE only succeeds from the
  // exact prior payment_status just confirmed above, and .select().maybeSingle()
  // returning null tells us we lost the race, not that something is broken.
  const { data: claimedRow, error: claimError } = await supabase
    .from("module_requests")
    .update({ payment_status: "processing" })
    .eq("id", requestId)
    .eq("status", "awaiting_payment")
    .in("payment_status", ["pending", "unpaid"])
    .select("id")
    .maybeSingle();
  if (claimError) return { claimed: false, error: `Could not claim this request: ${claimError.message}` };
  if (!claimedRow) {
    return { claimed: false, error: "This request was already claimed by another action just now — no duplicate analysis was run." };
  }

  return { claimed: true, moduleType: row.module_type as string, intakeData: row.intake_data };
}

/**
 * On any failure after a successful claim, revert to 'pending' (never
 * 'unpaid' — a failed Groq call says nothing about whether payment was
 * actually received, so reverting to 'unpaid' would misrepresent the
 * failure as a payment determination) so the same "Mark as paid" click is
 * immediately retryable with no stale 'processing' purgatory.
 */
async function revertModuleClaimOnFailure(supabase: SupabaseClient, requestId: string): Promise<void> {
  const { error } = await supabase
    .from("module_requests")
    .update({ payment_status: "pending" })
    .eq("id", requestId)
    .eq("payment_status", "processing");
  if (error) throw new Error(`revertModuleClaimOnFailure failed: ${error.message}`);
}

/** Loads the company's owning user id for a module request — the real recipient for every client-facing notification this file fires. */
async function loadModuleRequestOwner(supabase: SupabaseClient, requestId: string): Promise<string | null> {
  const { data } = await supabase.from("module_requests").select("companies(user_id)").eq("id", requestId).maybeSingle();
  const owner = data?.companies as unknown as { user_id: string } | null;
  return owner?.user_id ?? null;
}

/**
 * The reviewer's "Mark as unpaid" action — a real, explicit, visible
 * outcome ("I checked, this hasn't been paid"), genuinely revisable later
 * (a reviewer can come back and mark the same request paid once payment
 * actually arrives — same claim mechanism either way, since 'unpaid' is
 * one of the two states claimModuleRequestForAnalysis() accepts from).
 *
 * Fires a real client-facing notification (confirmed 2026-09-07, unified
 * flow spec) — a real, previously-confirmed gap: this only ever touched
 * the DB before, telling the client nothing.
 */
export async function markModuleUnpaid(requestId: string): Promise<ModulePaymentActionResult> {
  const supabase = createAdminClient();
  // Real, narrow concurrency bug found and fixed while extending this
  // function (confirmed 2026-09-07): the original WHERE clause only
  // checked `status`, not `payment_status` — a "Mark as unpaid" click
  // landing WHILE a concurrent "Mark as paid" claim was mid-flight
  // (payment_status: 'processing', the real Groq call still running)
  // could silently overwrite it back to 'unpaid', which would then make
  // the analysis's own finalize step (`.eq("payment_status","processing")`)
  // match zero rows — findings would still get inserted, but the request
  // would incorrectly stay stuck at 'awaiting_payment'/'unpaid'. Scoping
  // this to `payment_status = 'pending'` closes the window: a request
  // already 'processing' (claimed) or already 'paid' correctly refuses.
  const { data, error } = await supabase
    .from("module_requests")
    .update({ payment_status: "unpaid" })
    .eq("id", requestId)
    .eq("status", "awaiting_payment")
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This request is no longer awaiting payment, or is already being processed." };

  const recipientId = await loadModuleRequestOwner(supabase, requestId);
  if (recipientId) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: recipientId,
      event_type: "module_unpaid",
      channel: "email",
      related_module_request_id: requestId,
      sent_at: null,
    });
    if (notifError) throw new Error(`markModuleUnpaid: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}

/**
 * The reviewer's "Cancel" action (confirmed 2026-09-07, unified flow spec)
 * — the real case where a reviewer has followed up about unpaid status and
 * either side decides to give up rather than leave the request open
 * indefinitely. Only reachable from 'awaiting_payment' (a request already
 * analyzed and in the normal review pipeline goes through the existing
 * Accept/Edit/Reject/Approve/Deliver flow instead — canceling something
 * already reviewable isn't this action's job). A real, required reason,
 * same discipline as session_requests' own decline-reason field, and a
 * real client-facing email carrying it.
 */
export async function cancelModuleRequest(requestId: string, reason: string): Promise<ModulePaymentActionResult> {
  if (!reason.trim()) return { success: false, error: "A cancellation reason is required." };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_requests")
    .update({ status: "canceled", cancellation_reason: reason.trim() })
    .eq("id", requestId)
    .eq("status", "awaiting_payment")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This request is no longer awaiting payment — it may already be past cancellation." };

  const recipientId = await loadModuleRequestOwner(supabase, requestId);
  if (recipientId) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: recipientId,
      event_type: "module_canceled",
      channel: "email",
      related_module_request_id: requestId,
      sent_at: null,
    });
    if (notifError) throw new Error(`cancelModuleRequest: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}

/**
 * The reviewer's "Mark as paid" action — claims the request, dispatches to
 * the correct module's own real analysis-after-payment function (a real,
 * synchronous Groq call), and on success finalizes with `payment_status:
 * 'paid'` + `status: 'pending_review'` (done inside each module's own
 * runXAnalysisAfterPayment, alongside its own findings insert, so the two
 * writes that make a request genuinely reviewable land together).
 */
export async function markModulePaidAndRunAnalysis(requestId: string): Promise<ModulePaymentActionResult> {
  const supabase = createAdminClient();
  const claim = await claimModuleRequestForAnalysis(supabase, requestId);
  if (!claim.claimed) return { success: false, error: claim.error };

  try {
    switch (claim.moduleType) {
      case "tender_readiness":
        await runTenderReadinessAnalysisAfterPayment(requestId, claim.intakeData);
        break;
      case "ai_reliability":
        await runAiReliabilityAnalysisAfterPayment(requestId, claim.intakeData);
        break;
      case "data_protection":
        await runDataProtectionAnalysisAfterPayment(requestId, claim.intakeData);
        break;
      default:
        throw new Error(`Unknown module_type '${claim.moduleType}'`);
    }
    return { success: true };
  } catch (e) {
    await revertModuleClaimOnFailure(supabase, requestId);
    return {
      success: false,
      error: `Marked the claim, but the real analysis failed: ${e instanceof Error ? e.message : "unknown error"}. Payment status was reverted to 'pending' — you can try marking it paid again.`,
    };
  }
}
