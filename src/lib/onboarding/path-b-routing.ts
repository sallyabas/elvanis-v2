/**
 * Path B (AI Compliance Audit onboarding) routing logic — confirmed
 * 2026-08-27, Onboarding Architecture & Path Routing brief, Part 3, plus
 * the same-day founder refinement (a third triage question, and a fix for
 * the "active request but no AI yet" gap). Deterministic, computed in
 * code — same discipline as every other jurisdiction/applicability
 * decision in this codebase (tender-readiness/jurisdiction.ts,
 * data-protection-compliance/jurisdiction.ts): this is a routing decision
 * with a small, enumerable answer space, never something to hand to an
 * LLM.
 *
 * Two independent axes, not one exclusive route:
 * - `primary`: the AI-usage/compliance-request axis (Q1 x Q2) — Tender
 *   Readiness, AI Reliability Audit, human consultation, or a fork into
 *   the full Core Audit (see the `core_audit` case below).
 * - `additional`: the personal-data axis (Q3) — Data Protection
 *   Compliance is recommended independently of the primary route
 *   whenever the company handles personal data, per the founder's own
 *   explicit correction: "a company's internal/external AI split doesn't
 *   actually indicate whether they handle personal data" — Q3 must never
 *   be inferred from Q1.
 *
 * The `core_audit` case is NOT "Path B routes into the AI Opportunity &
 * Readiness module" — no such standalone product exists. Per the
 * founder's own confirmed decision, a company still exploring/unsure
 * about AI gets routed into a REAL, full Core Audit (reusing Path A's
 * existing goal-selection step) so the AI & Governance lens this branch
 * promises actually gets generated — this branch is honestly "Path A,
 * entered via Path B."
 *
 * The Q2=active_request override (refinement): a company with an active
 * compliance/procurement request always gets flagged urgent, regardless
 * of Q1. When Q1 indicates real AI usage (customer_facing/internal_only),
 * the original matrix's Tender Readiness routing already handles this
 * correctly — no bug there. The gap this refinement closes is
 * specifically the exploring/not_sure rows, which previously fell through
 * to the catch-all core_audit route and silently dropped the active
 * request; those now route to human consultation instead (a real
 * jurisdiction determination needs real registration/market data this
 * company may not even have reason to know yet, and Tender Readiness
 * itself isn't the right instrument for "I have an active ask and don't
 * know what I'm dealing with" — a human conversation is).
 */

export type TriageAiUsage = "customer_facing" | "internal_only" | "exploring" | "not_sure";
export type TriageComplianceRequest = "active_request" | "want_ahead" | "not_applicable";
export type TriagePersonalData = "yes" | "no" | "not_sure";

export type PathBModule = "tender_readiness" | "ai_reliability" | "data_protection";

export type PathBRecommendation =
  | { kind: "module"; module: PathBModule; urgent: boolean; reason: string }
  | { kind: "consultation"; urgent: boolean; reason: string }
  | { kind: "core_audit"; reason: string };

export interface PathBRoutingResult {
  primary: PathBRecommendation;
  /** Additional recommendations alongside `primary` — currently only ever Data Protection Compliance via Q3, and only when `primary` isn't already that same module. */
  additional: PathBRecommendation[];
}

const HAS_REAL_AI_USE = (ai: TriageAiUsage): boolean => ai === "customer_facing" || ai === "internal_only";

export function computePathBRouting(
  aiUsage: TriageAiUsage,
  complianceRequest: TriageComplianceRequest,
  personalData: TriagePersonalData,
): PathBRoutingResult {
  let primary: PathBRecommendation;

  if (complianceRequest === "active_request") {
    if (HAS_REAL_AI_USE(aiUsage)) {
      primary = {
        kind: "module",
        module: "tender_readiness",
        urgent: true,
        reason: "You have an active compliance or procurement request and AI already in use — Tender Readiness gets you a real jurisdiction determination and draft answers fast.",
      };
    } else {
      // The refinement: don't silently default to core_audit here just
      // because there's no AI in production yet — an active request
      // needs a real person, not a module, since we don't yet know
      // enough (registration/market data, what the request is even
      // asking) to point at a specific audit confidently.
      primary = {
        kind: "consultation",
        urgent: true,
        reason: "You have an active compliance or procurement request but no AI in production yet — this needs a real conversation with your reviewer, not a module, so we understand exactly what's being asked before recommending one.",
      };
    }
  } else if (HAS_REAL_AI_USE(aiUsage)) {
    primary = {
      kind: "module",
      module: "ai_reliability",
      urgent: false,
      reason: "You have AI in production with no active compliance request — an AI Reliability Audit tests it against documented real-world failure patterns before an external party asks you to prove it's safe.",
    };
  } else {
    primary = {
      kind: "core_audit",
      reason: "No AI in production yet and nothing urgent — a full business diagnosis (including the AI & Governance lens) is the more useful starting point than a standalone AI module right now.",
    };
  }

  const additional: PathBRecommendation[] = [];
  // "yes" or "not_sure" both surface Data Protection Compliance — same
  // cautious-default discipline used elsewhere in this codebase (an
  // uncertain answer to a risk question is treated as worth surfacing,
  // not silently excluded).
  if ((personalData === "yes" || personalData === "not_sure") && !(primary.kind === "module" && primary.module === "data_protection")) {
    additional.push({
      kind: "module",
      module: "data_protection",
      urgent: false,
      reason:
        personalData === "yes"
          ? "You handle customer or employee personal data — Data Protection Compliance covers this independently of your AI usage."
          : "You weren't sure whether you handle personal data — worth a real look via Data Protection Compliance, since getting this wrong is a real, separate exposure from AI governance.",
    });
  }

  return { primary, additional };
}
