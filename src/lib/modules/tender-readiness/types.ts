import type { ConfidenceLevel, Severity } from "@/lib/lenses/types";
import type { CompanyJurisdictionInput, JurisdictionApplicability } from "./jurisdiction";

/**
 * Tender Readiness (spec §1.8b, confirmed 2026-08-02) — AI-specific
 * risk-classification content across EU AI Act, UAE DIFC Regulation 10,
 * and Saudi AI governance (SDAIA), never GDPR/PDPL-style data protection
 * (Data Protection Compliance's job). Applicability is deterministic
 * (jurisdiction.ts); the AI's job is narrower — draft content within
 * whatever sections code has already determined apply.
 */
export type TenderReadinessSection = "eu_ai_act" | "uae_difc_reg10" | "saudi_ai_governance" | "uae_ai_charter_reference";

export interface TenderReadinessFinding {
  findingId: string;
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: Severity;
  section: TenderReadinessSection;
  evidenceCited: string[];
  confidenceLevel: ConfidenceLevel;
  isMissingDataFinding: boolean;
}

export interface TenderReadinessDraftInput {
  companyId: string;
  company: CompanyJurisdictionInput;
  aiUseCaseInventory: string;
  existingDocumentation: string | null;
}

export interface TenderReadinessDraftResult {
  applicability: JurisdictionApplicability;
  findings: TenderReadinessFinding[];
  notes?: string;
}
