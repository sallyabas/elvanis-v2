import { createAdminClient } from "@/lib/supabase/admin";
import { runDataProtectionComplianceAudit } from "./index";
import type { DataProtectionDraftInput } from "./types";

/**
 * Runs the module and persists into the generic module_requests/
 * module_findings tables (same pattern as AI Reliability Audit and Tender
 * Readiness, spec §1.8d/§Generic module review architecture). Created
 * directly in `pending_review`, same precedent as the other two modules —
 * no client-facing "submit for review" edit-window flow exists yet.
 */
export async function runAndPersistDataProtectionComplianceAudit(input: DataProtectionDraftInput): Promise<{ requestId: string; findingCount: number }> {
  const result = await runDataProtectionComplianceAudit(input);
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .insert({
      module_type: "data_protection",
      company_id: input.companyId,
      status: "pending_review",
      intake_data: { ...input, applicability: result.applicability },
    })
    .select("id")
    .single();
  if (requestError) throw new Error(`runAndPersistDataProtectionComplianceAudit: failed to create request: ${requestError.message}`);

  const requestId = request.id as string;

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
    if (findingsError) throw new Error(`runAndPersistDataProtectionComplianceAudit: failed to persist findings: ${findingsError.message}`);
  }

  return { requestId, findingCount: result.findings.length };
}
