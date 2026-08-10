import Link from "next/link";
import type { EvidenceFieldInput, LensFinding, LensType, Severity } from "@/lib/lenses/types";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { MetricInput } from "@/lib/lenses/metrics";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import { deriveRoadmap } from "@/lib/reports/roadmap";
import { EVIDENCE_FIELD_SETS } from "@/lib/evidence/field-sets";
import { loadGovernanceDimensions } from "@/lib/lenses/benchmarks-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_LIVE_COMPANY_ID, DEMO_LIVE_REPORT_ID } from "@/lib/demo-live/config";

/**
 * Real, live, no-login demo (confirmed 2026-08-07, item 6 of the landing
 * page product-clarity pass) — replaces the "walk through mock data" gap
 * the founder flagged in the previous /demo prototype (compressed timers,
 * never connected to Supabase, by original design). This route shows one
 * fixed, real, already-delivered report from a real seeded test company
 * (see src/lib/demo-live/config.ts for exactly which one and why),
 * mirroring the structure of the real authenticated Dashboard and Report
 * pages so a visitor sees the actual product's output, not a simulation.
 *
 * Security posture, deliberately narrow — this is the one new
 * unauthenticated public surface in this app besides the marketing pages
 * themselves (the same category of decision already flagged with its own
 * caution for Digital Presence Scan). Kept as safe as an unauthenticated
 * route can be:
 *   - No dynamic route segment at all — the company/report IDs are fixed
 *     constants, not a URL param, so there is no enumeration surface onto
 *     any OTHER company's real data.
 *   - Strictly read-only. No forms, no session-request buttons, no sprint-
 *     interest buttons, no links that write anything — every interactive
 *     element from the real report/dashboard pages that would attempt a
 *     write is simply omitted here, not disabled-but-present.
 *   - ISR-cached (`revalidate`), same reasoning as the landing page: real-
 *     time freshness doesn't matter for a fixed demo of already-delivered
 *     test data, and it keeps this from hitting the DB on every visitor.
 */
export const revalidate = 300;

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

function displayedContent(f: FindingRow): LensFinding {
  return f.reviewer_edited_content ?? f.ai_draft;
}

export default async function DemoLivePage() {
  const admin = createAdminClient();

  const { data: company } = await admin.from("companies").select("id, name, industry").eq("id", DEMO_LIVE_COMPANY_ID).single();
  const { data: report } = await admin
    .from("reports")
    .select("id, top_3_finding_ids, goal_id, source_evidence_snapshot")
    .eq("id", DEMO_LIVE_REPORT_ID)
    .single();
  if (!company || !report) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-sm text-neutral-500">Demo temporarily unavailable.</p>
      </div>
    );
  }

  const { data: goal } = report.goal_id ? await admin.from("goals").select("primary_goal").eq("id", report.goal_id).maybeSingle() : { data: null };
  const { data: findings } = await admin
    .from("lens_findings")
    .select("id, lens, ai_draft, reviewer_edited_content, reviewer_status")
    .eq("report_id", report.id);

  const visibleFindings = ((findings ?? []) as FindingRow[]).filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited");
  const top3FindingIds = new Set((report.top_3_finding_ids as string[]) ?? []);
  const top3 = visibleFindings.filter((f) => top3FindingIds.has(f.id)).map(displayedContent);
  const roadmap = deriveRoadmap(top3);

  const byLens = new Map<LensType, FindingRow[]>();
  for (const f of visibleFindings) {
    byLens.set(f.lens, [...(byLens.get(f.lens) ?? []), f]);
  }

  const { data: sprint } = await admin
    .from("execution_sprints")
    .select("id, status, target_end_date, selected_finding_id")
    .eq("company_id", company.id)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sprintFindingTitle: string | null = null;
  let sprintTaskCounts: { done: number; total: number } | null = null;
  if (sprint) {
    const { data: findingRow } = await admin
      .from("lens_findings")
      .select("ai_draft, reviewer_edited_content")
      .eq("id", sprint.selected_finding_id)
      .maybeSingle();
    const findingContent = (findingRow?.reviewer_edited_content ?? findingRow?.ai_draft) as LensFinding | undefined;
    sprintFindingTitle = findingContent?.title ?? null;

    const { data: sprintTasks } = await admin.from("sprint_tasks").select("status").eq("execution_sprint_id", sprint.id).neq("reviewer_status", "rejected");
    const total = sprintTasks?.length ?? 0;
    const done = (sprintTasks ?? []).filter((t) => t.status === "done").length;
    sprintTaskCounts = { done, total };
  }

  const evidenceSnapshot = report.source_evidence_snapshot as SourceEvidenceSnapshot | null;
  const governanceDimensions = evidenceSnapshot ? await loadGovernanceDimensions() : [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-neutral-900">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight text-neutral-50">
            Elvanis
          </Link>
          <Link href="/client-login" className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover">
            Start your free audit
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8 rounded-lg border-2 border-accent bg-accent/5 p-4 text-sm">
          <p className="font-medium text-neutral-900 dark:text-neutral-50">
            You&apos;re looking at a real, complete example — {company.name}, a test company, not a real client.
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            Every screen below is the actual live app, not a mockup: real AI-drafted findings, reviewed and approved
            by a human, exactly the way your own report would work. Nothing here is editable — sign up to run your
            own audit.
          </p>
        </div>

        <h1 className="mb-1 text-2xl font-semibold">{company.name}&apos;s Execution Audit</h1>
        {goal && <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">Goal: {GOAL_LABELS[goal.primary_goal as keyof typeof GOAL_LABELS]}</p>}

        {/* "Dashboard" section — mirrors the real authenticated Dashboard
            page's content (top-3 quick list, active sprint tile, roadmap
            status), read-only. */}
        <section className="mb-10 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Dashboard</p>
          <h2 className="mb-3 font-medium">Latest top-3 priorities</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            {top3.map((f) => (
              <li key={f.findingId}>{f.title}</li>
            ))}
          </ol>

          {sprint && (
            <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <h2 className="mb-2 font-medium">Active Execution Sprint</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{sprintFindingTitle ?? "In progress"}</p>
              {sprintTaskCounts && (
                <p className="mt-1 text-sm text-neutral-500">
                  {sprintTaskCounts.done} of {sprintTaskCounts.total} tasks done
                </p>
              )}
              {sprint.target_end_date && <p className="mt-1 text-sm text-neutral-500">Target end {sprint.target_end_date}</p>}
            </div>
          )}
        </section>

        {/* "Report" section — mirrors the real client Report page. */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Full report</p>

        {top3.length > 0 && (
          <section className="mb-10 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 text-lg font-medium">Top 3 priorities</h2>
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

        {/* "Findings" — every lens with visible findings, full detail. */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Findings</p>
        {LENS_ORDER.filter((lens) => byLens.has(lens)).map((lens) => (
          <section key={lens} className="mb-8">
            <h2 className="mb-3 text-lg font-medium">{LENS_LABELS[lens]}</h2>
            <div className="space-y-3">
              {byLens.get(lens)!.map((row) => {
                const f = displayedContent(row);
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
                  </div>
                );
              })}
            </div>
          </section>
        ))}

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

        <section className="mt-10 rounded-lg bg-neutral-900 p-8 text-center">
          <h2 className="text-xl font-semibold text-neutral-50">This is what your real report will look like.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-300">Your first completed audit is free. No card required, no password — just your email.</p>
          <Link
            href="/client-login"
            className="mt-6 inline-block rounded bg-accent px-5 py-3 text-sm font-medium text-accent-ink hover:bg-accent-hover"
          >
            Start your free audit
          </Link>
        </section>
      </div>
    </div>
  );
}
