/**
 * Deterministic jurisdiction applicability for Tender Readiness (spec
 * §1.8b, confirmed 2026-08-02) — computed in code, never AI-judged. Same
 * reasoning as the numeric-benchmark-comparison fix (metrics.ts):
 * applicability is a factual, rules-based question with a right answer,
 * not something to leave to LLM interpretation. The AI's job is narrower —
 * draft checklist content and findings WITHIN whatever sections this
 * function determines apply, never decide applicability itself.
 *
 * Domain boundary (same discipline as §1.8a in reverse): only AI-*specific*
 * regimes are in scope here. Federal PDPL, ADGM DPR 2021, Saudi PDPL, and
 * GDPR are general/AI-agnostic data-protection regimes — Data Protection
 * Compliance's job, not this module's, even though they're part of the
 * same UAE/Saudi regulatory landscape researched in §1.8c.
 */

import { normalize, EU_MEMBER_STATES, SAUDI_ARABIA_NAMES, UAE_NAMES } from "../shared/regions";

export interface CompanyJurisdictionInput {
  registrationCountry: string | null;
  uaeFreeZone: "mainland" | "difc" | "adgm" | null;
  customerMarketCountries: string[];
}

export interface JurisdictionApplicability {
  /** EU AI Act 4-tier risk classification — triggered by an EU member-state customer market. */
  euAiAct: boolean;
  /** UAE's one AI-specific regulation — triggered by DIFC registration specifically, not UAE registration generally. */
  uaeDifcReg10: boolean;
  /** SDAIA's 7 AI Ethics Principles + draft Responsible AI Policy — distinct from Saudi PDPL (Data Protection Compliance's job). */
  saudiAiGovernance: boolean;
  /** Non-binding reference content only — never a compliance obligation the way the others are. */
  uaeAiCharterReference: boolean;
}

export function computeJurisdictionApplicability(company: CompanyJurisdictionInput): JurisdictionApplicability {
  const customerMarkets = company.customerMarketCountries.map(normalize);
  const isUaeRegistered = company.registrationCountry !== null && UAE_NAMES.has(normalize(company.registrationCountry));

  return {
    euAiAct: customerMarkets.some((c) => EU_MEMBER_STATES.has(c)),
    uaeDifcReg10: isUaeRegistered && company.uaeFreeZone === "difc",
    saudiAiGovernance: customerMarkets.some((c) => SAUDI_ARABIA_NAMES.has(c)),
    uaeAiCharterReference: isUaeRegistered,
  };
}

/** True if no section applies — a company entirely outside this module's regulatory scope. */
export function hasNoApplicableSections(applicability: JurisdictionApplicability): boolean {
  return !applicability.euAiAct && !applicability.uaeDifcReg10 && !applicability.saudiAiGovernance && !applicability.uaeAiCharterReference;
}
