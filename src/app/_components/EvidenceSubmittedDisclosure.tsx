import type { EvidenceFieldInput } from "@/lib/lenses/types";
import type { MetricInput } from "@/lib/lenses/metrics";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import { EVIDENCE_FIELD_SETS, COMMERCIAL_METRICS } from "@/lib/evidence/field-sets";

/**
 * Shared "what did I actually submit" renderer (extracted 2026-08-12,
 * closing real bug list item #4: "the client has no visible history of
 * their own evidence intake... submitted answers are not retained/viewable
 * anywhere on their side"). Previously this ~90-line block only existed
 * inline in the delivered client Report page — meaning a client could only
 * ever see their own submitted evidence AFTER a report was fully reviewed
 * and sent, not while it was still saved/editing or locked and queued for
 * analysis. Extracted so both surfaces render from one implementation,
 * same "shared logic, can't drift" discipline as deriveRoadmap()/
 * getTotalTurnaroundHours()/computeJourneyStatus().
 */
export interface EvidenceSnapshotShape {
  financial: { evidenceFields: EvidenceFieldInput[]; metrics?: MetricInput[] };
  execution: { evidenceFields: EvidenceFieldInput[]; metrics?: MetricInput[] };
  product: { evidenceFields: EvidenceFieldInput[]; metrics?: MetricInput[] };
  commercial: CommercialSelfReport;
  aiGovernance: {
    hasLiveAiInProduction: boolean;
    governanceDocsSubmitted: boolean;
    questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
    governanceEvidence?: EvidenceFieldInput[];
  };
}

export interface GovernanceDimensionForDisplay {
  key: GovernanceDimensionKey;
  label: string;
}

export function EvidenceSubmittedDisclosure({
  evidenceSnapshot,
  governanceDimensions,
  title = "Evidence submitted",
  defaultOpen = false,
}: {
  evidenceSnapshot: EvidenceSnapshotShape;
  governanceDimensions: GovernanceDimensionForDisplay[];
  title?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-lg border border-neutral-200 dark:border-neutral-800" open={defaultOpen}>
      <summary className="cursor-pointer px-5 py-3 text-lg font-medium">{title}</summary>
      <div className="space-y-6 border-t border-neutral-200 p-5 dark:border-neutral-800">
        {EVIDENCE_FIELD_SETS.map((set) => {
          const submitted = evidenceSnapshot[set.lens].evidenceFields;
          const submittedMetrics = evidenceSnapshot[set.lens].metrics ?? [];
          return (
            <div key={set.lens}>
              <h3 className="mb-2 text-sm font-medium">{set.title}</h3>
              {set.metrics.length > 0 && (
                <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
                  {set.metrics.map((m) => {
                    const match = submittedMetrics.find((v) => v.metricKey === m.metricKey);
                    return (
                      <div key={m.metricKey}>
                        <dt className="text-neutral-500 dark:text-neutral-400">
                          {m.label}
                          {m.unit && ` (${m.unit})`}
                        </dt>
                        <dd className={match ? "text-neutral-700 dark:text-neutral-300" : "italic text-neutral-400"}>
                          {match ? match.value : "Not provided"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              <dl className="space-y-2 text-sm">
                {set.fields.map((field) => {
                  const match = submitted.find((f) => f.fieldName === field.key);
                  return (
                    <div key={field.key}>
                      <dt className="text-neutral-500 dark:text-neutral-400">{field.label}</dt>
                      <dd className={match?.fieldValue ? "text-neutral-700 dark:text-neutral-300" : "italic text-neutral-400"}>
                        {match?.fieldValue || "Not provided"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}

        <div>
          <h3 className="mb-2 text-sm font-medium">Commercial / Market</h3>
          {/* Commercial's own metrics (added 2026-08-25, real gap fix) —
              same display pattern as the FIELD_SETS loop above. */}
          {COMMERCIAL_METRICS.length > 0 && (
            <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
              {COMMERCIAL_METRICS.map((m) => {
                const match = (evidenceSnapshot.commercial.metrics ?? []).find((v) => v.metricKey === m.metricKey);
                return (
                  <div key={m.metricKey}>
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      {m.label}
                      {m.unit && ` (${m.unit})`}
                    </dt>
                    <dd className={match ? "text-neutral-700 dark:text-neutral-300" : "italic text-neutral-400"}>
                      {match ? match.value : "Not provided"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">Named competitors</dt>
              <dd className={evidenceSnapshot.commercial.namedCompetitors.length > 0 ? "text-neutral-700 dark:text-neutral-300" : "italic text-neutral-400"}>
                {evidenceSnapshot.commercial.namedCompetitors.length > 0 ? evidenceSnapshot.commercial.namedCompetitors.join(", ") : "Not provided"}
              </dd>
            </div>
            {(
              [
                ["Market change notes", evidenceSnapshot.commercial.marketChangeNotes],
                ["Pricing pressure notes", evidenceSnapshot.commercial.pricingPressureNotes],
                ["Lost deals notes", evidenceSnapshot.commercial.lostDealsNotes],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
                <dd className={value ? "text-neutral-700 dark:text-neutral-300" : "italic text-neutral-400"}>{value || "Not provided"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">AI &amp; Governance</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">Live AI in production</dt>
              <dd className="text-neutral-700 dark:text-neutral-300">{evidenceSnapshot.aiGovernance.hasLiveAiInProduction ? "Yes" : "No"}</dd>
            </div>
            {evidenceSnapshot.aiGovernance.governanceDocsSubmitted ? (
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Governance documentation description</dt>
                <dd className="text-neutral-700 dark:text-neutral-300">
                  {evidenceSnapshot.aiGovernance.governanceEvidence?.[0]?.fieldValue || "Not provided"}
                </dd>
              </div>
            ) : (
              governanceDimensions.map((dim) => {
                const score = evidenceSnapshot.aiGovernance.questionnaireScores?.[dim.key];
                return (
                  <div key={dim.key}>
                    <dt className="text-neutral-500 dark:text-neutral-400">{dim.label}</dt>
                    <dd className={score !== undefined ? "text-neutral-700 dark:text-neutral-300" : "italic text-neutral-400"}>
                      {score !== undefined ? `${score} / 3` : "Not provided"}
                    </dd>
                  </div>
                );
              })
            )}
          </dl>
        </div>
      </div>
    </details>
  );
}
