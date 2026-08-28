import { createAdminClient } from "@/lib/supabase/admin";
import { notifyReviewersOfNewModuleRequest } from "@/lib/reviewer/notifications";
import { isCompanyRequestUrgent } from "@/lib/onboarding/compute-request-urgency";
import { runTenderReadinessAudit } from "./index";
import type { TenderReadinessDraftInput } from "./types";

/**
 * Runs the module and persists into the generic module_requests/
 * module_findings tables (same pattern as AI Reliability Audit, spec
 * §1.8b/§Generic module review architecture). Created directly in
 * `pending_review`, same precedent as the core audit and AI Reliability —
 * no client-facing "submit for review" edit-window flow exists yet.
 *
 * Notifies every reviewer on real submission (confirmed 2026-08-15, module
 * intake/service flow review) — closes a real gap: this previously fired
 * nothing at all, unlike a core-audit report's new_submission notification.
 */
export async function runAndPersistTenderReadinessAudit(input: TenderReadinessDraftInput): Promise<{ requestId: string; findingCount: number }> {
  const result = await runTenderReadinessAudit(input);
  const supabase = createAdminClient();

  // Urgency flag (confirmed 2026-08-27, Onboarding Architecture & Path
  // Routing brief, Part 3/8f) — computed once, at creation, from the
  // company's own current triage answer. See isCompanyRequestUrgent's own
  // docblock for why this is a live read rather than a value threaded
  // through the onboarding UI.
  const isUrgent = await isCompanyRequestUrgent(supabase, input.companyId);

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .insert({
      module_type: "tender_readiness",
      company_id: input.companyId,
      status: "pending_review",
      intake_data: { ...input, applicability: result.applicability },
      is_urgent: isUrgent,
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

  await notifyReviewersOfNewModuleRequest(supabase);

  return { requestId, findingCount: result.findings.length };
}
