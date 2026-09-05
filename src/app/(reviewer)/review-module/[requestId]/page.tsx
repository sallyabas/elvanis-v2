import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";
import { computeStalenessWarnings, listApplicableFrameworksMetadata } from "@/lib/reviewer/regulatory-staleness";
import { ModuleReviewWorkspaceClient } from "./ModuleReviewWorkspaceClient";

const MODULE_LABELS: Record<string, string> = {
  ai_reliability: "AI Reliability Audit",
  tender_readiness: "Tender Readiness",
  data_protection: "Data Protection Compliance",
};

export default async function ModuleReviewWorkspacePage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .select("id, module_type, status, created_at, approved_at, delivered_at, is_urgent, intake_data, company_id, companies(name)")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return <div className="p-6 text-sm text-red-600">Failed to load request: {requestError?.message ?? "not found"}</div>;
  }

  const { data: findings, error: findingsError } = await supabase
    .from("module_findings")
    .select("id, ai_draft, reviewer_edited_content, reviewer_status, reviewer_notes, confidence_level, is_missing_data_finding")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (findingsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load findings: {findingsError.message}</div>;
  }

  // Procurement answers only apply to Tender Readiness, and only once
  // findings are approved (see procurement-answers.ts docblock) — for
  // every other module/status this is just an empty array.
  const { data: procurementAnswers, error: procurementError } = await supabase
    .from("procurement_answers")
    .select("id, category, question, ai_draft_answer, regulations_cited, reviewer_status, reviewer_edited_answer, reviewer_notes")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (procurementError) {
    return <div className="p-6 text-sm text-red-600">Failed to load procurement answers: {procurementError.message}</div>;
  }

  const company = request.companies as unknown as { name: string } | null;

  /**
   * Real gap found and fixed 2026-08-15 (module intake/service flow
   * review, item 6) — confirmed against real data first, not assumed:
   * a Tender Readiness request for a company with no registration_country
   * / customer_market_countries set correctly computed zero applicable
   * jurisdictions and zero findings (the deterministic logic itself was
   * never wrong), but the reviewer workspace showed a bare "No findings."
   * with no context, and the procurement-answers section still offered a
   * "Generate" button that would only ever throw the same dead-end error.
   * Both Tender Readiness and Data Protection Compliance store
   * `intake_data.applicability` — checking whether every flag is false is
   * enough to distinguish "genuinely nothing applies" from any other
   * empty-findings case, without needing to import either module's
   * specific applicability type into this generic workspace.
   */
  const applicability = (request.intake_data as { applicability?: Record<string, boolean> } | null)?.applicability;
  const hasNoApplicableJurisdiction =
    (request.module_type === "tender_readiness" || request.module_type === "data_protection") &&
    !!applicability &&
    Object.values(applicability).every((v) => v === false);

  // Real, new (confirmed 2026-09-03, direct founder request) — unlike the
  // core audit's own ambient version of this warning (see that
  // workspace's page.tsx), this one genuinely IS about the request's own
  // content: intake_data.applicability is this specific request's real,
  // frozen jurisdiction determination, made at submission time. Uses the
  // same real, applicable (true) keys already extracted above for
  // hasNoApplicableJurisdiction — no separate computation needed. Correctly
  // produces an empty array for AI Reliability Audit requests (no
  // applicability field exists for that module) with no special-casing.
  const applicableJurisdictionKeys = applicability ? Object.entries(applicability).filter(([, v]) => v).map(([k]) => k) : [];
  const regulatoryStalenessWarnings = await computeStalenessWarnings(applicableJurisdictionKeys);
  // Real gap closed (confirmed 2026-09-05) — see listApplicableFrameworksMetadata()'s own docblock: the original brief's "report metadata showing frameworks + last-reviewed date" is always-shown, distinct from the RED/AMBER-only warning banner above.
  const applicableFrameworksMetadata = await listApplicableFrameworksMetadata(applicableJurisdictionKeys);

  return (
    <>
      {/* Real navigation-audit fix (confirmed 2026-08-26) — see the
          equivalent fix's docblock in review/[reportId]/page.tsx. Own
          mx-auto/px-6 wrapper, not shared with ModuleReviewWorkspaceClient
          below (which already wraps itself the same way). */}
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <Link
          href={`/company/${request.company_id}`}
          className="inline-block text-sm text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← {company?.name ?? "Unknown company"}
        </Link>
      </div>
      <ModuleReviewWorkspaceClient
        requestId={request.id}
        companyName={company?.name ?? "Unknown company"}
        moduleLabel={MODULE_LABELS[request.module_type as string] ?? (request.module_type as string)}
        requestStatus={request.status}
        moduleType={request.module_type as string}
        findings={findings}
        procurementAnswers={procurementAnswers ?? []}
        timing={{
          createdAt: request.created_at,
          approvedAt: request.approved_at,
          deliveredAt: request.delivered_at,
          deliveryTargetHours: await getSettingNumber("module_delivery_turnaround_target_hours", 48),
        }}
        isUrgent={Boolean(request.is_urgent)}
        hasNoApplicableJurisdiction={hasNoApplicableJurisdiction}
        regulatoryStalenessWarnings={regulatoryStalenessWarnings}
        applicableFrameworksMetadata={applicableFrameworksMetadata}
      />
    </>
  );
}
