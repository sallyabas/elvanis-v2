import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, module_type, status, created_at, approved_at, intake_data, company_id, companies(name)")
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

  return (
    <>
      {/* Real navigation-audit fix (confirmed 2026-08-26) — see the
          equivalent fix's docblock in review/[reportId]/page.tsx. Own
          mx-auto/px-6 wrapper, not shared with ModuleReviewWorkspaceClient
          below (which already wraps itself the same way). */}
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <Link
          href={`/company/${request.company_id}`}
          className="inline-block text-sm text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
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
        timing={{ createdAt: request.created_at, approvedAt: request.approved_at }}
        hasNoApplicableJurisdiction={hasNoApplicableJurisdiction}
      />
    </>
  );
}
