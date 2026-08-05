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
    .select("id, module_type, status, created_at, approved_at, companies(name)")
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

  return (
    <ModuleReviewWorkspaceClient
      requestId={request.id}
      companyName={company?.name ?? "Unknown company"}
      moduleLabel={MODULE_LABELS[request.module_type as string] ?? (request.module_type as string)}
      requestStatus={request.status}
      moduleType={request.module_type as string}
      findings={findings}
      procurementAnswers={procurementAnswers ?? []}
      timing={{ createdAt: request.created_at, approvedAt: request.approved_at }}
    />
  );
}
