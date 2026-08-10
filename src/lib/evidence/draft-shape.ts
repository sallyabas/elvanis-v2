import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { EvidenceFieldInput } from "@/lib/lenses/types";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { MetricInput } from "@/lib/lenses/metrics";

/**
 * Shape of the form's own local state (confirmed 2026-08-05, saved draft
 * intake) — mirrors what EvidenceIntakeForm.tsx keeps in useState, not a
 * typed evidence submission. Extracted here (2026-08-10, delayed-execution
 * architecture) so it can be shared between the client component and the
 * server-side converter below, instead of living only inline in
 * EvidenceIntakeForm.tsx where a server component couldn't reference it.
 */
export interface EvidenceIntakeDraft {
  fieldValues?: Record<string, string>;
  metricValues?: Record<string, string>;
  namedCompetitors?: string;
  marketChangeNotes?: string;
  pricingPressureNotes?: string;
  lostDealsNotes?: string;
  hasLiveAiInProduction?: boolean;
  governanceDocsSubmitted?: boolean;
  governanceEvidenceText?: string;
  dimensionScores?: Partial<Record<GovernanceDimensionKey, number>>;
}

interface EvidencePayloadLensSection {
  evidenceFields: EvidenceFieldInput[];
  metrics?: MetricInput[];
}

export interface EvidencePayload {
  financial: EvidencePayloadLensSection;
  execution: EvidencePayloadLensSection;
  product: EvidencePayloadLensSection;
  commercial: CommercialSelfReport;
  aiGovernance: {
    hasLiveAiInProduction: boolean;
    governanceDocsSubmitted: boolean;
    questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
    governanceEvidence?: EvidenceFieldInput[];
  };
}

/**
 * Converts a real, already-submitted pending_evidence_submissions.evidence_payload
 * back into the form's own draft shape (confirmed 2026-08-10, delayed-
 * execution architecture) — needed because clearEvidenceIntakeDraft()
 * already wipes the ephemeral autosave draft the instant a real submission
 * succeeds, so a client returning to /evidence-intake to actually EDIT
 * their submitted evidence (the whole point of the edit window) would
 * otherwise see a blank form despite having real evidence on record. The
 * reverse of evidenceFieldsFor()/metricsFor() in EvidenceIntakeForm.tsx.
 */
export function evidencePayloadToDraft(payload: EvidencePayload): EvidenceIntakeDraft {
  const fieldValues: Record<string, string> = {};
  const metricValues: Record<string, string> = {};

  for (const lens of ["financial", "execution", "product"] as const) {
    const section = payload[lens];
    for (const f of section.evidenceFields ?? []) {
      if (f.fieldValue) fieldValues[`${lens}.${f.fieldName}`] = f.fieldValue;
    }
    for (const m of section.metrics ?? []) {
      metricValues[`${lens}.${m.metricKey}`] = String(m.value);
    }
  }

  return {
    fieldValues,
    metricValues,
    namedCompetitors: (payload.commercial.namedCompetitors ?? []).join(", "),
    marketChangeNotes: payload.commercial.marketChangeNotes ?? "",
    pricingPressureNotes: payload.commercial.pricingPressureNotes ?? "",
    lostDealsNotes: payload.commercial.lostDealsNotes ?? "",
    hasLiveAiInProduction: payload.aiGovernance.hasLiveAiInProduction,
    governanceDocsSubmitted: payload.aiGovernance.governanceDocsSubmitted,
    governanceEvidenceText: payload.aiGovernance.governanceEvidence?.[0]?.fieldValue ?? "",
    dimensionScores: payload.aiGovernance.questionnaireScores ?? {},
  };
}
