import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EvidenceFieldInput, LensFinding, LensType } from "@/lib/lenses/types";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import { deriveRoadmap } from "@/lib/reports/roadmap";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { EVIDENCE_FIELD_SETS } from "@/lib/evidence/field-sets";
import { loadGovernanceDimensions } from "@/lib/lenses/benchmarks-repository";

interface SourceEvidenceSnapshot {
  financial: { evidenceFields: EvidenceFieldInput[] };
  execution: { evidenceFields: EvidenceFieldInput[] };
  product: { evidenceFields: EvidenceFieldInput[] };
  commercial: CommercialSelfReport;
  aiGovernance: {
    hasLiveAiInProduction: boolean;
    governanceDocsSubmitted: boolean;
    questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
    governanceEvidence?: EvidenceFieldInput[];
  };
}

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
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Your report is being reviewed</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          We&apos;ll have this ready within 72 hours. Check back soon.
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">{company.name}&apos;s Execution Audit</h1>
      {goal && <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">Goal: {GOAL_LABELS[goal.primary_goal as keyof typeof GOAL_LABELS]}</p>}

      <div className="mb-8 flex flex-wrap gap-3">
        <SessionRequestButton companyId={company.id} sessionType="delivery" />
        {hasRequestedDelivery && <SessionRequestButton companyId={company.id} sessionType="f2f_workshop" />}
        <Link
          href="/evidence-intake"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Submit new evidence
        </Link>
      </div>

      {top3.length > 0 && (
        <section className="mb-10 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-lg font-medium">Top 3 priorities</h2>
          <ol className="list-inside list-decimal space-y-3 text-sm">
            {top3.map((f) => (
              <li key={f.findingId}>
                <span className="font-medium">{f.title}</span>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{f.recommendedAction}</p>
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
              return (
                <div key={row.id} className="rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-xs uppercase text-neutral-400">{f.severity}</span>
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
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {visibleFindings.length === 0 && <p className="text-sm text-neutral-500">No findings to show yet.</p>}

      {evidenceSnapshot && (
        <section className="mt-10">
          <details className="rounded-lg border border-neutral-200 dark:border-neutral-800">
            <summary className="cursor-pointer px-5 py-3 text-lg font-medium">Evidence submitted</summary>
            <div className="space-y-6 border-t border-neutral-200 p-5 dark:border-neutral-800">
              {EVIDENCE_FIELD_SETS.map((set) => {
                const submitted = evidenceSnapshot[set.lens].evidenceFields;
                return (
                  <div key={set.lens}>
                    <h3 className="mb-2 text-sm font-medium">{set.title}</h3>
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
