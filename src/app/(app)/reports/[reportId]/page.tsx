import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EvidenceFieldInput, LensFinding, LensType, Severity } from "@/lib/lenses/types";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { MetricInput } from "@/lib/lenses/metrics";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import { deriveRoadmap } from "@/lib/reports/roadmap";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { SprintInterestButton } from "@/app/_components/SprintInterestButton";
import { EVIDENCE_FIELD_SETS } from "@/lib/evidence/field-sets";
import { loadGovernanceDimensions } from "@/lib/lenses/benchmarks-repository";
import { getTotalTurnaroundHours } from "@/lib/reports/sla";

interface SourceEvidenceSnapshot {
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

// Severity color-coding (confirmed 2026-08-06, honest UX review pass) —
// previously all four severities rendered as identical small gray
// uppercase text, so a report with findings across all 5 lenses had
// nothing to visually triage; every badge had to be read in full.
const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

const LENS_ORDER: LensType[] = ["financial", "execution", "product", "commercial", "ai_governance"];
const LENS_LABELS: Record<LensType, string> = {
  financial: "Financial",
  execution: "Execution / Operating",
  product: "Product / Customer",
  commercial: "Commercial / Market",
  ai_governance: "AI & Governance",
};

interface FindingRow {
  id: string;
  lens: LensType;
  ai_draft: LensFinding;
  reviewer_edited_content: LensFinding | null;
  reviewer_status: "draft" | "approved" | "edited" | "rejected";
}

function displayedContent(f: FindingRow): LensFinding {
  return f.reviewer_edited_content ?? f.ai_draft;
}

export default async function ClientReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  // RLS on `reports` only allows a client to SELECT rows with
  // status='sent' (confirmed by reading the migration directly — a real
  // mismatch found while building this page, not assumed) — matching the
  // deliberate design where deliverReport() is a separate, explicit step
  // from approveReport() (CLAUDE.md: "does NOT fire a real client
  // notification email itself — that's a separate, explicit, confirmed
  // step"). A plain session-client query for a not-yet-sent report would
  // return zero rows under RLS, indistinguishable from "doesn't exist."
  // The admin client is used here ONLY to check ownership + status so a
  // real client can be shown "still being reviewed" instead of a bare
  // 404 — the actual findings content below still goes through the
  // session client, which only succeeds once status='sent', exactly as
  // designed.
  const admin = createAdminClient();
  const { data: reportStatus, error: statusError } = await admin
    .from("reports")
    .select("id, status, company_id, companies(user_id)")
    .eq("id", reportId)
    .maybeSingle();

  if (statusError || !reportStatus) notFound();
  const owner = reportStatus.companies as unknown as { user_id: string } | null;
  if (owner?.user_id !== user.id) notFound();

  if (reportStatus.status !== "sent") {
    // Real bug found and fixed 2026-08-06 (honest UX review pass): this
    // used to hardcode "72 hours" while the submit confirmation modal a
    // moment earlier correctly computed the total from the DB-backed
    // edit_window_hours setting — the two could silently diverge the
    // moment that setting changed. Both now read getTotalTurnaroundHours().
    const { totalHours } = await getTotalTurnaroundHours();
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Your report is being reviewed</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          We&apos;ll have this ready within {totalHours} hours. We&apos;ll email you the moment it&apos;s ready — no
          need to keep checking back.
        </p>
      </div>
    );
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, top_3_finding_ids, goal_id, source_evidence_snapshot, companies!inner(id, name, user_id)")
    .eq("id", reportId)
    .single();
  if (reportError || !report) notFound();

  // Evidence library (confirmed 2026-08-06) — reads the exact evidence
  // payload the report was generated from, verbatim (same
  // source_evidence_snapshot rerun-audit.ts already relies on). Older
  // reports predating snapshot support have no stored evidence — handled
  // the same defensive way rerunAudit() does, not assumed present.
  const evidenceSnapshot = report.source_evidence_snapshot as SourceEvidenceSnapshot | null;
  const governanceDimensions = evidenceSnapshot ? await loadGovernanceDimensions() : [];

  const company = report.companies as unknown as { id: string; name: string; user_id: string };

  const { data: goal } = report.goal_id ? await supabase.from("goals").select("primary_goal").eq("id", report.goal_id).maybeSingle() : { data: null };

  const { data: findings, error: findingsError } = await supabase
    .from("lens_findings")
    .select("id, lens, ai_draft, reviewer_edited_content, reviewer_status")
    .eq("report_id", reportId);
  if (findingsError) throw new Error(`Failed to load findings: ${findingsError.message}`);

  const visibleFindings = ((findings ?? []) as FindingRow[]).filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited");
  const top3FindingIds = new Set((report.top_3_finding_ids as string[]) ?? []);
  const top3 = visibleFindings.filter((f) => top3FindingIds.has(f.id)).map(displayedContent);
  const roadmap = deriveRoadmap(top3);

  const byLens = new Map<LensType, FindingRow[]>();
  for (const f of visibleFindings) {
    byLens.set(f.lens, [...(byLens.get(f.lens) ?? []), f]);
  }

  // Service Layer session requests (confirmed 2026-08-06) — Delivery
  // Session is offered here since it's explicitly post-report only; F2F
  // Workshop only shows once a Delivery Session has already been
  // requested, since it's a premium upgrade OF that session specifically,
  // never offered before evidence submission or independently of it.
  const { data: existingSessionRequests } = await admin
    .from("session_requests")
    .select("session_type")
    .eq("company_id", company.id);
  const hasRequestedDelivery = (existingSessionRequests ?? []).some((r) => r.session_type === "delivery");

  // Client-facing Execution Sprint interest (confirmed 2026-08-06, honest
  // UX review pass) — see sprint_interest_requests migration docblock.
  // Session-scoped, not admin (RLS already restricts to the caller's own
  // company) — a finding with any existing request (open or resolved)
  // shows "requested" instead of the button again, avoiding duplicate spam.
  const { data: existingSprintInterest } = await supabase.from("sprint_interest_requests").select("finding_id").eq("report_id", reportId);
  const requestedFindingIds = new Set((existingSprintInterest ?? []).map((r) => r.finding_id as string));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">{company.name}&apos;s Execution Audit</h1>
      {goal && <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">Goal: {GOAL_LABELS[goal.primary_goal as keyof typeof GOAL_LABELS]}</p>}

      {top3.length > 0 && (
        <section className="mb-10 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-lg font-medium">Top 3 priorities</h2>
          {/* Shows the diagnosis (what was found), not the recommendedAction
              — confirmed 2026-08-06, honest UX review. Previously showed
              recommendedAction here, then the by-lens section below
              repeated the exact same sentence under its own "Recommended:"
              label — real, verbatim duplication on a report meant to be
              scannable at a glance, not a design choice. */}
          <ol className="list-inside list-decimal space-y-3 text-sm">
            {top3.map((f) => (
              <li key={f.findingId}>
                <span className="font-medium">{f.title}</span>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{f.diagnosis}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {top3.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium">30 / 60 / 90 day roadmap</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["day30", "day60", "day90"] as const).map((bucket, i) => (
              <div key={bucket} className="rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <h3 className="mb-2 font-medium">{[30, 60, 90][i]} days</h3>
                {roadmap[bucket].length === 0 ? (
                  <p className="text-neutral-400">Nothing at this horizon</p>
                ) : (
                  <ul className="space-y-1">
                    {roadmap[bucket].map((f) => (
                      <li key={f.findingId}>{f.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {LENS_ORDER.filter((lens) => byLens.has(lens)).map((lens) => (
        <section key={lens} className="mb-8">
          <h2 className="mb-3 text-lg font-medium">{LENS_LABELS[lens]}</h2>
          <div className="space-y-3">
            {byLens.get(lens)!.map((row) => {
              const f = displayedContent(row);
              // Missing-evidence findings get a visually distinct card
              // (confirmed 2026-08-06, honest UX review) — previously
              // "Insufficient evidence for product/customer analysis"
              // rendered in the exact same card style and severity badge
              // as a genuine analytical finding like "Gross Margin Trend,"
              // so a first-time reader had to read the full sentence to
              // realize it wasn't a real issue. isMissingDataFinding is
              // the existing structural flag every lens already sets —
              // no new schema needed, just using what was already there.
              return (
                <div
                  key={row.id}
                  className={
                    f.isMissingDataFinding
                      ? "rounded border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                      : "rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800"
                  }
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{f.title}</span>
                    {f.isMissingDataFinding ? (
                      <span className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        No evidence submitted
                      </span>
                    ) : (
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[f.severity]}`}>
                        {f.severity}
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-neutral-600 dark:text-neutral-400">{f.diagnosis}</p>
                  <p className="mb-1 text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Why: </span>
                    {f.rootCause}
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">Recommended: </span>
                    {f.recommendedAction}
                  </p>
                  {f.financialImpact && (f.financialImpact.impactBandLow !== null || f.financialImpact.impactBandHigh !== null) && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Estimated impact: {f.financialImpact.impactBandLow ?? "?"}–{f.financialImpact.impactBandHigh ?? "?"} {f.financialImpact.currency ?? ""}
                    </p>
                  )}
                  {/* Client-facing Execution Sprint interest (confirmed
                      2026-08-06, honest UX review) — gated to critical/high
                      severity, same "high-priority" threshold this codebase
                      already uses for isFixFirstCandidate() elsewhere.
                      Never shown on isMissingDataFinding rows — there's
                      nothing to implement when the gap is "you didn't
                      submit evidence," not a real finding. */}
                  {!f.isMissingDataFinding && (f.severity === "critical" || f.severity === "high") && (
                    <SprintInterestButton
                      companyId={company.id}
                      reportId={reportId}
                      findingId={row.id}
                      alreadyRequested={requestedFindingIds.has(row.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {visibleFindings.length === 0 && <p className="text-sm text-neutral-500">No findings to show yet.</p>}

      {/*
       * Next steps — moved here from the top of the page, and no longer
       * all rendered with identical visual weight (confirmed 2026-08-06,
       * honest UX review). Previously these three buttons — "Request a
       * Delivery Session," "Request an F2F Workshop," "Submit new
       * evidence" — were the very first thing on the page, above every
       * finding, with zero explanation of what any of them were, and
       * "Submit new evidence" (which starts a new paid re-audit cycle)
       * looked exactly like the two "request a call" buttons next to it.
       * Now: shown after the client has actually read their findings,
       * session requests get the framed/explained treatment
       * (SessionRequestButton now carries its own description), and
       * "Submit new evidence" is deliberately a plain text link with its
       * own cautionary line, not a bordered button of equal weight.
       */}
      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-medium">Next steps</h2>
        <SessionRequestButton companyId={company.id} sessionType="delivery" />
        {hasRequestedDelivery && <SessionRequestButton companyId={company.id} sessionType="f2f_workshop" />}
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Have new evidence to add?{" "}
          <Link href="/evidence-intake" className="underline">
            Submit new evidence
          </Link>{" "}
          — note this starts a new, paid re-audit cycle (your free audit has already been used).
        </p>
      </section>

      {evidenceSnapshot && (
        <section className="mt-10">
          <details className="rounded-lg border border-neutral-200 dark:border-neutral-800">
            <summary className="cursor-pointer px-5 py-3 text-lg font-medium">Evidence submitted</summary>
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
                <h3 className="mb-2 text-sm font-medium">AI & Governance</h3>
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
        </section>
      )}
    </div>
  );
}
