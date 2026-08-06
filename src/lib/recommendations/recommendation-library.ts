import type { LensType } from "@/lib/lenses/types";

/**
 * Recommendation library by issue type — seed version (confirmed 2026-08-06,
 * spec §4a.2: "seed version moved to V1, hand-built from your own domain
 * expertise, same logic as Tender Readiness's external research; richer
 * version stays V2, grown from real case volume"). Genuinely not built
 * until this pass — confirmed by grep during the 2026-08-05 status check
 * (see CLAUDE.md).
 *
 * Curated, hand-written reference content — NOT LLM-generated, same
 * "curated, not AI-generated" treatment as AI Reliability's
 * self-test-prompts.ts and Tender Readiness's procurement-categories.ts.
 * Deliberately reviewer-facing REFERENCE material, not injected into any
 * lens prompt: findings must stay grounded in the client's actual submitted
 * evidence (hard rule 1 in every lens prompt), and auto-injecting a
 * templated playbook risks homogenizing genuinely per-company reasoning
 * into boilerplate. The reviewer sees a matched entry as inspiration when
 * editing a finding's recommendedAction — never auto-applied, never shown
 * to the client directly.
 *
 * Matching is deterministic keyword overlap against a finding's title +
 * diagnosis, scoped to the same lens the entry belongs to — never an LLM
 * judgment call, same "deterministic wherever code can already produce the
 * answer" principle used throughout this codebase (jurisdiction
 * applicability, benchmark tiers, fix-first flagging). A finding matching
 * zero keywords simply shows no suggestion — that's correct, not a gap;
 * this is a seed library, not an exhaustive one.
 *
 * DB-backed as of 2026-08-06 (confirmed by the hardcoded-values audit),
 * same "admin-adjustable, not a constant" principle as the lens benchmarks
 * — see repository.ts for the loader. This file holds only the type shape,
 * the DEFAULT constant (fallback + seed source of truth), and the pure
 * matching function, which now takes the library as a parameter instead of
 * reading a module-level const — same refactor as the lens benchmarks, so
 * it's independently testable (see recommendation-library.test-cases.ts).
 */

export type IssueTypeKey =
  | "no_financial_visibility"
  | "customer_concentration"
  | "thin_margin"
  | "short_runway"
  | "decision_latency"
  | "meeting_overload"
  | "no_operating_reporting"
  | "low_feature_adoption"
  | "high_churn"
  | "weak_onboarding_activation"
  | "pricing_pressure"
  | "weak_differentiation"
  | "recurring_lost_deal_pattern"
  | "no_ai_governance_docs"
  | "no_human_oversight"
  | "unclear_ai_risk_classification";

export interface RecommendationLibraryEntry {
  key: IssueTypeKey;
  label: string;
  lens: LensType;
  /** Lowercase keywords/phrases checked against a finding's title + diagnosis. */
  keywords: string[];
  /** A proven starting template — the reviewer adapts it to the specific finding, never pastes it verbatim. */
  recommendedActionTemplate: string;
  rationale: string;
}

/** Fallback used if the DB read fails or returns incomplete data — also the seed data's own source of truth. */
export const DEFAULT_RECOMMENDATION_LIBRARY: RecommendationLibraryEntry[] = [
  {
    key: "no_financial_visibility",
    label: "No real-time/near-real-time financial visibility",
    lens: "financial",
    keywords: ["financial visibility", "no visibility into", "don't track", "don't have visibility", "manual spreadsheet"],
    recommendedActionTemplate:
      "Stand up monthly (ideally weekly) cash flow and gross-margin reporting from the existing accounting system, owned by a named person, reviewed on a fixed cadence — start with the 3-5 numbers that actually drive decisions rather than a full BI build.",
    rationale: "The single most common root blocker behind every other financial finding this lens sees — you can't manage what you can't see.",
  },
  {
    key: "customer_concentration",
    label: "High revenue concentration in a small number of customers",
    lens: "financial",
    keywords: ["concentration", "concentrated in", "top customer", "largest customer"],
    recommendedActionTemplate:
      "Map renewal dates and contract terms for the top 3-5 accounts by revenue; build a named-account retention plan for each, and set an explicit new-logo target sized to reduce concentration below a stated threshold within a defined timeframe.",
    rationale: "Concentration risk is a real, common driver of churn/retention goal exposure, not just a financial-lens curiosity.",
  },
  {
    key: "thin_margin",
    label: "Gross margin below benchmark for stage/model",
    lens: "financial",
    keywords: ["margin below", "margin is below", "thin margin", "margin compression", "margin erosion", "eroding margin"],
    recommendedActionTemplate:
      "Break down cost of goods/delivery by line item against the specific benchmark gap identified; target the single largest contributor first rather than an across-the-board cost-cutting exercise.",
    rationale: "A generic \"cut costs\" recommendation is rarely actionable — anchoring to the specific gap keeps this concrete.",
  },
  {
    key: "short_runway",
    label: "Runway below the client's own risk threshold",
    lens: "financial",
    keywords: ["runway", "burn rate", "months of runway"],
    recommendedActionTemplate:
      "Build a 13-week rolling cash forecast (not just a monthly view) and identify the top 2-3 levers (spend cuts, collections timing, financing options) with a decision deadline tied to the actual runway number, not a vague \"soon.\"",
    rationale: "Runway findings need a forecast cadence tighter than monthly reporting can provide — weekly precision matters when the number is small.",
  },
  {
    key: "decision_latency",
    label: "Slow decision/approval chains",
    lens: "execution",
    keywords: ["approval chain", "decision latency", "approval delay", "decisions get stuck", "waiting for approval"],
    recommendedActionTemplate:
      "Delegate a defined class of decisions below a stated dollar/impact threshold to the person closest to the work, with an explicit escalation path only for exceptions above that threshold — set a target turnaround SLA and track it.",
    rationale: "Blanket \"speed up decisions\" advice rarely sticks; a concrete delegation threshold does.",
  },
  {
    key: "meeting_overload",
    label: "Excessive meeting load eating into execution time",
    lens: "execution",
    keywords: ["meeting load", "meeting overload", "too many meetings", "meetings eating"],
    recommendedActionTemplate:
      "Run a two-week meeting audit (who, why, could this be async) across the leadership team specifically, then cut or convert to async anything without a decision or genuine cross-functional need — protect at least one full no-meeting block per day.",
    rationale: "Leadership meeting load compounds fastest and has the clearest labor-hours cost to quantify.",
  },
  {
    key: "no_operating_reporting",
    label: "No operating-maturity reporting infrastructure (financial, delivery, or otherwise)",
    lens: "execution",
    keywords: ["no crm", "no reporting", "no dashboard", "operating maturity", "no visibility into"],
    recommendedActionTemplate:
      "Pick the single highest-value operating metric currently invisible (often financial, sometimes delivery or pipeline) and stand up the minimum reporting needed to see it weekly — resist building a full system before proving the habit sticks.",
    rationale: "This is Execution's own territory even when the missing visibility is financial/commercial in nature — the process gap, not the numbers themselves.",
  },
  {
    key: "low_feature_adoption",
    label: "Core feature adoption below benchmark",
    lens: "product",
    keywords: ["low adoption", "low core feature adoption", "adoption is well below", "adoption well below"],
    recommendedActionTemplate:
      "Instrument the specific drop-off point in the activation flow (not just top-line adoption %), then redesign onboarding around getting a new user to first real value within one session — don't add features before fixing the funnel.",
    rationale: "Low adoption is almost always a funnel problem, not a feature-richness problem — the recommendation should point at the funnel.",
  },
  {
    key: "high_churn",
    label: "Churn rate above benchmark",
    lens: "product",
    keywords: ["churn", "churning", "cancellations"],
    recommendedActionTemplate:
      "Stand up a lightweight exit-interview process (even 3 questions) for every cancellation for the next quarter, tagged by reason — most churn-reduction efforts fail because the actual reason was never captured systematically.",
    rationale: "You can't fix churn you can't categorize — the data-capture step comes before any retention tactic.",
  },
  {
    key: "weak_onboarding_activation",
    label: "Weak onboarding / activation experience",
    lens: "product",
    keywords: ["onboarding", "activation", "first value", "time to value"],
    recommendedActionTemplate:
      "Map the current path from signup to first meaningful value, identify the single biggest drop-off step, and redesign only that step first — a full onboarding rebuild is rarely the fastest path to improvement.",
    rationale: "Scoping to the single worst step keeps this genuinely actionable rather than a multi-quarter project.",
  },
  {
    key: "pricing_pressure",
    label: "Competitive pricing pressure forcing discounting",
    lens: "commercial",
    keywords: ["pricing pressure", "undercutting", "discount", "forced to discount"],
    recommendedActionTemplate:
      "Audit the last 5-10 discounted deals for the actual objection raised (price vs. perceived value vs. missing feature) before changing list price — a pricing change aimed at the wrong root cause won't move the needle.",
    rationale: "Pricing pressure is often a value-communication problem wearing a price-tag disguise; diagnose before repricing.",
  },
  {
    key: "weak_differentiation",
    label: "No clear stated differentiation from named competitors",
    lens: "commercial",
    keywords: ["differentiat", "no clear differentiator", "better value"],
    recommendedActionTemplate:
      "Run a short positioning exercise against the specific competitor(s) actually being lost to — one clear, evidence-backed reason a prospect should choose you, tested in the next 5 sales conversations before rolling out broadly.",
    rationale: "Generic \"improve positioning\" advice doesn't survive contact with a real sales call; anchoring to a named competitor does.",
  },
  {
    key: "recurring_lost_deal_pattern",
    label: "A recurring, named reason showing up across multiple lost deals",
    lens: "commercial",
    keywords: ["lost deal", "lost to", "losses to"],
    recommendedActionTemplate:
      "Formalize a lightweight win/loss log (reason, competitor, deal size) for the next quarter of deals — most companies at this stage have anecdotal loss reasons, not a real pattern to act on yet.",
    rationale: "One or two lost-deal notes aren't a pattern; the recommendation should build the muscle to find real patterns, not react to anecdotes.",
  },
  {
    key: "no_ai_governance_docs",
    label: "No AI governance documentation despite live/planned AI use",
    lens: "ai_governance",
    keywords: ["no governance documentation", "no ai use inventory", "no documented", "governance gap"],
    recommendedActionTemplate:
      "Produce a one-page AI use inventory (what AI is used where, on what data, with what human oversight) before adding any further AI-powered functionality — this is the prerequisite most other governance dimensions build on.",
    rationale: "Matches the deterministic guaranteed finding this lens already produces for exactly this combination — the recommendation should be the same every time, not reinvented per audit.",
  },
  {
    key: "no_human_oversight",
    label: "AI-generated outputs reach customers/decisions without human review",
    lens: "ai_governance",
    keywords: ["no human oversight", "no human review", "without review", "unreviewed"],
    recommendedActionTemplate:
      "Add a mandatory human checkpoint before any AI-generated output reaches a customer or feeds a consequential business decision, scoped to start with the highest-risk use case identified — not necessarily every use case at once.",
    rationale: "A phased rollout of oversight (highest-risk first) gets adopted; \"review everything immediately\" usually doesn't.",
  },
  {
    key: "unclear_ai_risk_classification",
    label: "No risk classification for AI systems in use",
    lens: "ai_governance",
    keywords: ["risk classification", "not classified", "unclear risk"],
    recommendedActionTemplate:
      "Classify each current AI use case against a simple risk tier (informational/assistive vs. decision-affecting vs. high-stakes) as a first pass — this doesn't need to be a formal EU AI Act conformity exercise yet (that's Tender Readiness's job) to be genuinely useful internally.",
    rationale: "Distinguishes this lens's job (governance maturity) from Tender Readiness's deeper regulatory classification work — the recommendation should stay at the right depth.",
  },
];

function normalize(text: string): string {
  return text.toLowerCase();
}

/**
 * Deterministic keyword match, scoped to the finding's own lens. Returns
 * entries sorted by number of matched keywords (most relevant first).
 * Empty array is a normal, expected result for most findings — this is a
 * seed library covering common patterns, not an exhaustive taxonomy.
 */
export function matchRecommendationLibraryEntries(
  library: RecommendationLibraryEntry[],
  lens: LensType,
  title: string,
  diagnosis: string,
): RecommendationLibraryEntry[] {
  const haystack = normalize(`${title} ${diagnosis}`);
  const scored = library
    .filter((entry) => entry.lens === lens)
    .map((entry) => ({
      entry,
      matchCount: entry.keywords.filter((k) => haystack.includes(k)).length,
    }))
    .filter((s) => s.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);

  return scored.map((s) => s.entry);
}
