import { createAdminClient } from "@/lib/supabase/admin";
import type { AiOpportunitySynthesisResult } from "./ai-opportunity";

/**
 * Never called before 2026-08-02 — synthesizeAiOpportunities() only ever
 * returned a result object; nothing wrote it to ai_opportunity_synthesis /
 * readiness_scores. Both tables are scoped by report_id now (see
 * supabase/migrations/20260802120000), not just company_id — a company can
 * have more than one report (re-audits), so company_id alone can't tell you
 * which synthesis run belongs to which report.
 */
export async function persistAiOpportunitySynthesis(
  reportId: string,
  companyId: string,
  result: AiOpportunitySynthesisResult,
): Promise<void> {
  const supabase = createAdminClient();

  const { error: readinessError } = await supabase.from("readiness_scores").insert({
    report_id: reportId,
    company_id: companyId,
    data_quality: result.readinessScores.dataQuality,
    team_skill: result.readinessScores.teamSkill,
    process_maturity: result.readinessScores.processMaturity,
    governance_foundation: result.readinessScores.governanceFoundation,
  });
  if (readinessError) throw new Error(`persistAiOpportunitySynthesis: failed to insert readiness_scores: ${readinessError.message}`);

  if (result.opportunities.length > 0) {
    const { error: opportunitiesError } = await supabase.from("ai_opportunity_synthesis").insert(
      result.opportunities.map((o) => ({
        report_id: reportId,
        company_id: companyId,
        source_finding_ids: o.sourceFindingIds,
        opportunity_description: o.opportunityDescription,
        readiness_status: o.readinessStatus,
        readiness_reasoning: o.readinessReasoning,
      })),
    );
    if (opportunitiesError) throw new Error(`persistAiOpportunitySynthesis: failed to insert ai_opportunity_synthesis: ${opportunitiesError.message}`);
  }

  const { error: stampError } = await supabase
    .from("reports")
    .update({ ai_opportunity_synthesized_at: new Date().toISOString() })
    .eq("id", reportId);
  if (stampError) throw new Error(`persistAiOpportunitySynthesis: failed to stamp report: ${stampError.message}`);
}
