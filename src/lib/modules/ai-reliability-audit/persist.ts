import { createAdminClient } from "@/lib/supabase/admin";
import { notifyReviewersOfNewModuleRequest } from "@/lib/reviewer/notifications";
import { runAiReliabilityAudit } from "./index";
import type { AiReliabilityDraftInput } from "./types";

/**
 * Runs the module and persists into the generic module_requests/
 * module_findings tables (confirmed 2026-08-02) — the same tables Tender
 * Readiness and Data Protection Compliance will use. Created directly in
 * `pending_review` (no client-facing "submit for review" edit-window flow
 * exists yet for modules, same precedent as runAudit() creating `reports`
 * rows directly in `pending_review` before any client UI existed).
 */
export async function runAndPersistAiReliabilityAudit(input: AiReliabilityDraftInput): Promise<{ requestId: string; findingCount: number }> {
  const result = await runAiReliabilityAudit(input);
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .insert({
      module_type: "ai_reliability",
      company_id: input.companyId,
      status: "pending_review",
      intake_data: input,
    })
    .select("id")
    .single();
  if (requestError) throw new Error(`runAndPersistAiReliabilityAudit: failed to create request: ${requestError.message}`);

  const requestId = request.id as string;

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
    if (findingsError) throw new Error(`runAndPersistAiReliabilityAudit: failed to persist findings: ${findingsError.message}`);
  }

  // Real gap found and fixed 2026-08-15 (module intake/service flow
  // review) — a module request previously logged zero notification at
  // submission, unlike a core-audit report's new_submission.
  await notifyReviewersOfNewModuleRequest(supabase);

  return { requestId, findingCount: result.findings.length };
}
