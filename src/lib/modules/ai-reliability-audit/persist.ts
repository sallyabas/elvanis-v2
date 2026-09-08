import { createAdminClient } from "@/lib/supabase/admin";
import { notifyReviewersOfNewModuleRequest, notifyReviewersOfModuleAwaitingPayment } from "@/lib/reviewer/notifications";
import { runAiReliabilityAudit } from "./index";
import type { AiReliabilityDraftInput } from "./types";

/**
 * Module payment gate (confirmed 2026-09-06, direct founder decision) —
 * see tender-readiness/persist.ts's own docblock for the full design
 * (identical shape here — this module has no `applicability` concept, so
 * `intake_data` needs no re-enrichment step at finalize time, unlike
 * Tender Readiness/Data Protection).
 */
export async function createAwaitingPaymentAiReliabilityRequest(input: AiReliabilityDraftInput): Promise<{ requestId: string }> {
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .insert({
      module_type: "ai_reliability",
      company_id: input.companyId,
      status: "awaiting_payment",
      payment_status: "pending",
      intake_data: input,
    })
    .select("id")
    .single();
  if (requestError) throw new Error(`createAwaitingPaymentAiReliabilityRequest: failed to create request: ${requestError.message}`);

  const requestId = request.id as string;
  await notifyReviewersOfModuleAwaitingPayment(supabase, requestId);

  return { requestId };
}

export async function runAiReliabilityAnalysisAfterPayment(requestId: string, rawInput: unknown): Promise<{ findingCount: number }> {
  const input = rawInput as AiReliabilityDraftInput;
  const result = await runAiReliabilityAudit(input);
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("module_requests")
    .update({ status: "pending_review", payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("payment_status", "processing");
  if (updateError) throw new Error(`runAiReliabilityAnalysisAfterPayment: failed to finalize request: ${updateError.message}`);

  if (result.findings.length > 0) {
    const { error: findingsError } = await supabase.from("module_findings").insert(
      result.findings.map((f) => ({
        request_id: requestId,
        module_type: "ai_reliability",
        ai_draft: f,
        confidence_level: f.confidenceLevel,
        is_missing_data_finding: f.isMissingDataFinding,
      })),
    );
    if (findingsError) throw new Error(`runAiReliabilityAnalysisAfterPayment: failed to persist findings: ${findingsError.message}`);
  }

  await notifyReviewersOfNewModuleRequest(supabase);

  return { findingCount: result.findings.length };
}
