import { createAdminClient } from "@/lib/supabase/admin";
import { notifyReviewersOfNewModuleRequest, notifyReviewersOfModuleAwaitingPayment } from "@/lib/reviewer/notifications";
import { runDataProtectionComplianceAudit } from "./index";
import type { DataProtectionDraftInput } from "./types";

/**
 * Module payment gate (confirmed 2026-09-06, direct founder decision) —
 * see tender-readiness/persist.ts's own docblock for the full design
 * (identical shape here, including the `applicability` re-enrichment step
 * at finalize time — evidence-pack.ts reads `intake_data.applicability`
 * for this module too).
 */
export async function createAwaitingPaymentDataProtectionComplianceRequest(input: DataProtectionDraftInput): Promise<{ requestId: string }> {
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .insert({
      module_type: "data_protection",
      company_id: input.companyId,
      status: "awaiting_payment",
      payment_status: "pending",
      intake_data: input,
    })
    .select("id")
    .single();
  if (requestError) throw new Error(`createAwaitingPaymentDataProtectionComplianceRequest: failed to create request: ${requestError.message}`);

  const requestId = request.id as string;
  await notifyReviewersOfModuleAwaitingPayment(supabase, requestId);

  return { requestId };
}

export async function runDataProtectionAnalysisAfterPayment(requestId: string, rawInput: unknown): Promise<{ findingCount: number }> {
  const input = rawInput as DataProtectionDraftInput;
  const result = await runDataProtectionComplianceAudit(input);
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
  if (updateError) throw new Error(`runDataProtectionAnalysisAfterPayment: failed to finalize request: ${updateError.message}`);

  if (result.findings.length > 0) {
    const { error: findingsError } = await supabase.from("module_findings").insert(
      result.findings.map((f) => ({
        request_id: requestId,
        module_type: "data_protection",
        ai_draft: f,
        confidence_level: f.confidenceLevel,
        is_missing_data_finding: f.isMissingDataFinding,
      })),
    );
    if (findingsError) throw new Error(`runDataProtectionAnalysisAfterPayment: failed to persist findings: ${findingsError.message}`);
  }

  await notifyReviewersOfNewModuleRequest(supabase);

  return { findingCount: result.findings.length };
}
