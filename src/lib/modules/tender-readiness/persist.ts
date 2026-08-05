import { createAdminClient } from "@/lib/supabase/admin";
import { runTenderReadinessAudit } from "./index";
import type { TenderReadinessDraftInput } from "./types";

/**
 * Runs the module and persists into the generic module_requests/
 * module_findings tables (same pattern as AI Reliability Audit, spec
 * §1.8b/§Generic module review architecture). Created directly in
 * `pending_review`, same precedent as the core audit and AI Reliability —
 * no client-facing "submit for review" edit-window flow exists yet.
 */
export async function runAndPersistTenderReadinessAudit(input: TenderReadinessDraftInput): Promise<{ requestId: string; findingCount: number }> {
  const result = await runTenderReadinessAudit(input);
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .insert({
      module_type: "tender_readiness",
      company_id: input.companyId,
      status: "pending_review",
      intake_data: { ...input, applicability: result.applicability },
    })
    .select("id")
    .single();
  if (requestError) throw new Error(`runAndPersistTenderReadinessAudit: failed to create request: ${requestError.message}`);

  const requestId = request.id as string;

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
    if (findingsError) throw new Error(`runAndPersistTenderReadinessAudit: failed to persist findings: ${findingsError.message}`);
  }

  return { requestId, findingCount: result.findings.length };
}
