import { createAdminClient } from "@/lib/supabase/admin";
import { financialLens } from "@/lib/lenses/financial";
import { executionLens } from "@/lib/lenses/execution";
import { productLens } from "@/lib/lenses/product";
import { commercialLens, type CommercialSelfReport } from "@/lib/lenses/commercial";
import { aiGovernanceLens, type AiGovernanceDraftInput, type AiGovernanceMode } from "@/lib/lenses/ai-governance";
import type { OverallMaturityTier } from "@/lib/lenses/ai-governance-framework";
import type { IndependentResearchFinding } from "@/lib/lenses/commercial-research";
import { detectConflicts, type LensFindingWithSource } from "@/lib/synthesis/conflict-detection";
import type {
  CompanyProfileForLens,
  EvidenceFieldInput,
  EvidenceSufficiency,
  GoalContext,
  LensFinding,
  LensType,
} from "@/lib/lenses/types";
import type { MetricInput } from "@/lib/lenses/metrics";

/**
 * Orchestrates one full audit run (spec §2.3 steps 4-5, 8 setup): all five
 * lenses in parallel, persisted to lens_findings, then conflict detection
 * over the persisted set, persisted to finding_conflicts, then a `reports`
 * row created in pending_review so the Reviewer Queue picks it up.
 *
 * One lens failing must never block the others (spec §2.1) — Promise.
 * allSettled, not Promise.all.
 *
 * IDs: each lens generates its own draft-scoped findingId (e.g.
 * "financial-0") for internal use, but everything downstream (conflict
 * detection, AI opportunity synthesis, reviewer actions) needs the REAL
 * database UUID, since finding_conflicts/ai_opportunity_synthesis reference
 * lens_findings.id as a foreign key. Findings are persisted FIRST, then
 * re-tagged with their real UUID before conflict detection runs — no
 * separate id-mapping layer needed downstream.
 */

const EDIT_WINDOW_HOURS = 24;

export interface EvidenceForLens {
  evidenceFields: EvidenceFieldInput[];
  metrics: MetricInput[];
}

export interface RunAuditInput {
  companyId: string;
  company: CompanyProfileForLens;
  goalId: string;
  goal: GoalContext;
  financial: EvidenceForLens;
  execution: EvidenceForLens;
  product: EvidenceForLens;
  commercial: {
    selfReport: CommercialSelfReport;
    independentResearch: IndependentResearchFinding[];
  };
  aiGovernance: Omit<AiGovernanceDraftInput, "company" | "goal">;
}

export interface RunAuditResult {
  reportId: string;
  findings: LensFindingWithSource[];
  evidenceSufficiencyByLens: Partial<Record<LensType, EvidenceSufficiency>>;
  governanceMaturityTier: OverallMaturityTier | null;
  governanceMode: AiGovernanceMode | null;
  conflictCount: number;
  failedLenses: LensType[];
}

function scoreForDefaultRanking(f: LensFinding): number {
  // directly_blocks outranks directly_affects outranks directly_supports,
  // even though all three are "directly" tied to the goal — top-3 is about
  // what needs ACTION. directly_blocks and directly_affects are both real
  // problems (the primary obstruction vs. a direct, material cost/drag that
  // isn't the primary cause); directly_supports is healthy/positive and
  // isn't a fix-first candidate the way either problem-finding is, however
  // directly relevant it is. See GoalRelevance docblock in types.ts.
  const goalWeight = { directly_blocks: 4, directly_affects: 3, directly_supports: 2, indirectly_affects: 1, unrelated: 0 }[f.goalRelevance];
  const confidenceWeight = { high: 3, medium: 2, low: 1, insufficient: 0 }[f.confidenceLevel];
  return goalWeight * 2 + confidenceWeight;
}

export async function runAudit(input: RunAuditInput): Promise<RunAuditResult> {
  const supabase = createAdminClient();
  const failedLenses: LensType[] = [];
  const evidenceSufficiencyByLens: Partial<Record<LensType, EvidenceSufficiency>> = {};
  let governanceMaturityTier: OverallMaturityTier | null = null;
  let governanceMode: AiGovernanceMode | null = null;

  // Staggered, not launched in the exact same instant. Found via live
  // testing: firing all 5 lens calls simultaneously can burst past a
  // provider's per-minute token rate limit even when the daily quota is
  // fine — Groq's free tier caps at 12k tokens/min, and 5 concurrent
  // lens-sized prompts can exceed that in one instant. A small stagger
  // keeps them essentially parallel (still overlapping in-flight) while
  // being far more resilient to burst limits on any tier, not just free.
  const STAGGER_MS = 1500;
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const [financialSettled, executionSettled, productSettled, commercialSettled, governanceSettled] =
    await Promise.allSettled([
      financialLens.runDraft({ company: input.company, goal: input.goal, ...input.financial }),
      delay(STAGGER_MS).then(() => executionLens.runDraft({ company: input.company, goal: input.goal, ...input.execution })),
      delay(STAGGER_MS * 2).then(() => productLens.runDraft({ company: input.company, goal: input.goal, ...input.product })),
      delay(STAGGER_MS * 3).then(() => commercialLens.runDraft({ company: input.company, goal: input.goal, ...input.commercial })),
      delay(STAGGER_MS * 4).then(() => aiGovernanceLens.runDraft({ company: input.company, goal: input.goal, ...input.aiGovernance })),
    ]);

  const draftFindingsByLens: Array<{ lens: LensType; findings: LensFinding[] }> = [];

  if (financialSettled.status === "fulfilled") {
    draftFindingsByLens.push({ lens: "financial", findings: financialSettled.value.findings });
    evidenceSufficiencyByLens.financial = financialSettled.value.evidenceSufficiency;
  } else {
    failedLenses.push("financial");
  }

  if (executionSettled.status === "fulfilled") {
    draftFindingsByLens.push({ lens: "execution", findings: executionSettled.value.findings });
    evidenceSufficiencyByLens.execution = executionSettled.value.evidenceSufficiency;
  } else {
    failedLenses.push("execution");
  }

  if (productSettled.status === "fulfilled") {
    draftFindingsByLens.push({ lens: "product", findings: productSettled.value.findings });
    evidenceSufficiencyByLens.product = productSettled.value.evidenceSufficiency;
  } else {
    failedLenses.push("product");
  }

  if (commercialSettled.status === "fulfilled") {
    draftFindingsByLens.push({ lens: "commercial", findings: commercialSettled.value.findings });
    evidenceSufficiencyByLens.commercial = commercialSettled.value.evidenceSufficiency;
  } else {
    failedLenses.push("commercial");
  }

  if (governanceSettled.status === "fulfilled") {
    draftFindingsByLens.push({ lens: "ai_governance", findings: governanceSettled.value.findings });
    evidenceSufficiencyByLens.ai_governance = governanceSettled.value.evidenceSufficiency;
    governanceMaturityTier = governanceSettled.value.overallMaturity.tier;
    governanceMode = governanceSettled.value.mode;
  } else {
    failedLenses.push("ai_governance");
  }

  // Report row is created FIRST (empty top_3_finding_ids, filled in below)
  // so every lens_findings row can be linked to it via report_id — required
  // to correctly scope "this report's findings" across re-audit cycles.
  const submittedAt = new Date();
  const editWindowClosesAt = new Date(submittedAt.getTime() + EDIT_WINDOW_HOURS * 60 * 60 * 1000);

  const { data: reportRow, error: reportError } = await supabase
    .from("reports")
    .insert({
      company_id: input.companyId,
      goal_id: input.goalId,
      top_3_finding_ids: [],
      roadmap_30_60_90: {},
      status: "pending_review",
      submitted_at: submittedAt.toISOString(),
      edit_window_closes_at: editWindowClosesAt.toISOString(),
      // Persisted here, not just returned in-memory, so AI Opportunity
      // Synthesis can run later (post-approval, in a separate cron tick)
      // without recomputing — see supabase/migrations/20260802120000.
      evidence_sufficiency_by_lens: evidenceSufficiencyByLens,
      governance_maturity_tier: governanceMaturityTier,
    })
    .select("id")
    .single();

  if (reportError) throw new Error(`Failed to create report: ${reportError.message}`);
  const reportId = reportRow.id as string;

  // Persist findings first, then re-tag with the real DB UUID — see docblock.
  const persistedFindings: LensFindingWithSource[] = [];

  for (const { lens, findings } of draftFindingsByLens) {
    if (findings.length === 0) continue;

    const rows = findings.map((f) => ({
      company_id: input.companyId,
      report_id: reportId,
      lens,
      ai_draft: f,
      confidence_level: f.confidenceLevel,
      is_missing_data_finding: f.isMissingDataFinding,
      origin: f.origin ?? null,
    }));

    const { data, error } = await supabase.from("lens_findings").insert(rows).select("id, ai_draft");
    if (error) throw new Error(`Failed to persist ${lens} findings: ${error.message}`);

    for (const row of data) {
      persistedFindings.push({
        lens,
        finding: { ...(row.ai_draft as LensFinding), findingId: row.id as string },
      });
    }
  }

  const conflicts = await detectConflicts(persistedFindings);

  if (conflicts.length > 0) {
    const { error } = await supabase.from("finding_conflicts").insert(
      conflicts.map((c) => ({
        company_id: input.companyId,
        finding_a_id: c.findingAId,
        finding_b_id: c.findingBId,
        conflict_description: c.conflictDescription,
      })),
    );
    if (error) throw new Error(`Failed to persist conflicts: ${error.message}`);
  }

  const defaultTop3 = [...persistedFindings]
    .sort((a, b) => scoreForDefaultRanking(b.finding) - scoreForDefaultRanking(a.finding))
    .slice(0, 3)
    .map((f) => f.finding.findingId);

  const { error: top3Error } = await supabase.from("reports").update({ top_3_finding_ids: defaultTop3 }).eq("id", reportId);
  if (top3Error) throw new Error(`Failed to set default top-3: ${top3Error.message}`);

  return {
    reportId,
    findings: persistedFindings,
    evidenceSufficiencyByLens,
    governanceMaturityTier,
    governanceMode,
    conflictCount: conflicts.length,
    failedLenses,
  };
}
