import { createAdminClient } from "@/lib/supabase/admin";
import { notifyReviewersOfNewModuleRequest, notifyReviewersOfModuleAwaitingPayment } from "@/lib/reviewer/notifications";
import { isCompanyRequestUrgent } from "@/lib/onboarding/compute-request-urgency";
import { runTenderReadinessAudit } from "./index";
import type { TenderReadinessDraftInput } from "./types";

/**
 * Module payment gate (confirmed 2026-09-06, direct founder decision) —
 * closes a real, confirmed gap: this module ran a real, synchronous Groq
 * call on every submission with zero payment check of any kind. Split
 * into two real steps, no findings and no Groq call happen at submission
 * time anymore:
 *
 * 1. createAwaitingPaymentTenderReadinessRequest() — stores the raw
 *    intake, creates the request in 'awaiting_payment' status, notifies
 *    reviewers once. `intake_data` is deliberately the RAW input here,
 *    not yet enriched with `applicability` — that's computed as a side
 *    effect of the real audit run, which hasn't happened yet.
 * 2. runTenderReadinessAnalysisAfterPayment() — the reviewer's own "Mark
 *    as paid" action (see module-payment-gate.ts) calls this once a
 *    request has been atomically claimed. Runs the real audit, persists
 *    findings, and only THEN flips status to 'pending_review' and
 *    payment_status to 'paid' — the same moment `intake_data` gets
 *    enriched with `applicability` for the first time, since
 *    review-module/[requestId]/page.tsx, evidence-pack.ts, and
 *    procurement-answers.ts all read `intake_data.applicability` and
 *    must never see it missing once a request is genuinely reviewable.
 */
export async function createAwaitingPaymentTenderReadinessRequest(input: TenderReadinessDraftInput): Promise<{ requestId: string }> {
  const supabase = createAdminClient();

  // Urgency flag (confirmed 2026-08-27) is a live signal derived from the
  // company's own current triage answer — safe and correct to compute
  // here at raw-submission time, independent of whether the analysis has
  // run yet.
  const isUrgent = await isCompanyRequestUrgent(supabase, input.companyId);

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .insert({
      module_type: "tender_readiness",
      company_id: input.companyId,
      status: "awaiting_payment",
      payment_status: "pending",
      intake_data: input,
      is_urgent: isUrgent,
    })
    .select("id")
    .single();
  if (requestError) throw new Error(`createAwaitingPaymentTenderReadinessRequest: failed to create request: ${requestError.message}`);

  const requestId = request.id as string;
  await notifyReviewersOfModuleAwaitingPayment(supabase, requestId);

  return { requestId };
}

export async function runTenderReadinessAnalysisAfterPayment(requestId: string, rawInput: unknown): Promise<{ findingCount: number }> {
  const input = rawInput as TenderReadinessDraftInput;
  const result = await runTenderReadinessAudit(input);
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("module_requests")
    .update({
      status: "pending_review",
      payment_status: "paid",
      intake_data: { ...input, applicability: result.applicability },
    })
    .eq("id", requestId)
    .eq("payment_status", "processing");
  if (updateError) throw new Error(`runTenderReadinessAnalysisAfterPayment: failed to finalize request: ${updateError.message}`);

  if (result.findings.length > 0) {
    const { error: findingsError } = await supabase.from("module_findings").insert(
      result.findings.map((f) => ({
        request_id: requestId,
        module_type: "tender_readiness",
        ai_draft: f,
        confidence_level: f.confidenceLevel,
        is_missing_data_finding: f.isMissingDataFinding,
      })),
    );
    if (findingsError) throw new Error(`runTenderReadinessAnalysisAfterPayment: failed to persist findings: ${findingsError.message}`);
  }

  await notifyReviewersOfNewModuleRequest(supabase);

  return { findingCount: result.findings.length };
}
