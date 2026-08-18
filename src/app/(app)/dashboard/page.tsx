import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LensFinding } from "@/lib/lenses/types";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import { deriveRoadmap } from "@/lib/reports/roadmap";
import { loadRecommendationLibrary } from "@/lib/recommendations/repository";
import { computeCascadeSignals, type FindingForCascade } from "@/lib/recommendations/cascade";
import { computeJourneyStatus } from "@/lib/reports/journey-status";
import { loadGoalMetricTrend, type MetricTrend } from "@/lib/goals/metric-trend";
import { aggregateFinancialImpact, formatCurrencyRange, isUsableFinancialImpact } from "@/lib/reports/financial-impact";
import { MODULE_META, MODULE_ORDER, MODULE_STATUS_LABELS, type ModuleType } from "@/lib/modules/module-meta";
import { NextStepBanner } from "@/app/_components/NextStepBanner";
import { Card } from "@/app/_components/ui/Card";
import { LinkButton } from "@/app/_components/ui/LinkButton";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

/**
 * Dashboard, final consolidated redesign (confirmed 2026-08-16, direct
 * founder brief closing out the whole Dashboard-redesign thread). Builds
 * directly on the IA reorder from earlier the same broad pass (headline →
 * diagnosis → operational status → services) and adds the 10 concrete
 * items from the final brief:
 *
 * 1. Signals page — new standalone page, not built here (see
 *    src/app/(app)/signals/).
 * 2. "Does not apply to us" feedback — new shared component, not built
 *    here (see src/app/_components/FindingNotApplicableButton.tsx), wired
 *    into the Report/Signals pages, not Dashboard (Dashboard only ever
 *    shows the top-3 subset, not full finding detail).
 * 3. Client's stated goal — pinned, persistent, right under the page
 *    subtitle, not buried in Business Profile.
 * 4. Delivered/completed services stay off Dashboard as cards — a real,
 *    lightweight summary line near the active-requests area instead.
 * 5. Single action banner at the very top: the #1 priority, its real
 *    financial impact (when quantified), its real cascade count, one CTA.
 * 6. Top 3: severity + financial impact inline under each title.
 * 7. Real aggregated financial exposure across the top 3, an honest range
 *    from real per-finding data — see financial-impact.ts's own docblock
 *    for why this is genuinely real (LensFinding.financialImpact has
 *    existed and been populated by every lens since the original schema
 *    design) and not a new fabricated number.
 * 8. Real cascade count surfaced in the banner — reuses the exact same
 *    computeCascadeSignals() the roadmap already computes with, not a
 *    second implementation.
 * 9. Every "Your active requests" card gets one real explanatory line.
 * 10. Purely-informational sections re-evaluated against "what should I
 *     do / what happened" — see the end-of-file note on what was found.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company } = await supabase.from("companies").select("id, name").eq("user_id", user.id).maybeSingle();
  if (!company) {
    redirect("/onboarding");
  }

  const { data: latestReport } = await supabase
    .from("reports")
    .select("id, top_3_finding_ids")
    .eq("company_id", company.id)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const journeyStatus = await computeJourneyStatus(createAdminClient(), company.id as string);

  let top3: LensFinding[] = [];
  let allReportFindings: FindingForCascade[] = [];
  let top3WithIds: { id: string; finding: LensFinding }[] = [];
  if (latestReport) {
    const top3Ids = new Set((latestReport.top_3_finding_ids as string[]) ?? []);
    const { data: reportFindings } = await supabase
      .from("lens_findings")
      .select("id, lens, ai_draft, reviewer_edited_content, reviewer_status")
      .eq("report_id", latestReport.id);
    const visible = (reportFindings ?? []).filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited");
    top3WithIds = visible.filter((f) => top3Ids.has(f.id)).map((f) => ({ id: f.id as string, finding: (f.reviewer_edited_content ?? f.ai_draft) as LensFinding }));
    top3 = top3WithIds.map((t) => t.finding);
    allReportFindings = visible.map((f) => {
      const content = (f.reviewer_edited_content ?? f.ai_draft) as LensFinding;
      return { id: f.id as string, lens: f.lens, title: content.title, diagnosis: content.diagnosis };
    });
  }
  const recommendationLibrary = await loadRecommendationLibrary();
  const roadmap = deriveRoadmap(top3WithIds, allReportFindings, recommendationLibrary);

  // Real cascade signal for the #1 priority specifically (items 5/8) —
  // deliberately the SAME computeCascadeSignals() call deriveRoadmap()
  // already makes internally, not a second implementation that could
  // drift. Real, deterministic data (recommendation-library.ts's curated
  // cascade map), never an LLM judgment.
  const cascadeSignals = computeCascadeSignals(allReportFindings, recommendationLibrary);
  const topPriority = top3WithIds[0] ?? null;
  const topPriorityCascade = topPriority ? cascadeSignals.get(topPriority.id) : null;

  // Real aggregated financial exposure across the top 3 (item 7) — see
  // financial-impact.ts's own docblock for why this is real, existing
  // per-finding data, not a new number invented for this pass.
  const top3FinancialExposure = aggregateFinancialImpact(top3);

  // Client's stated goal, pinned (item 3) — the same `goals` row already
  // queried for the metric trend below, extended to also select
  // primary_goal/secondary_goal so this doesn't need a second query.
  const { data: currentGoal } = await supabase
    .from("goals")
    .select("primary_goal, secondary_goal, target_metric_key, target_metric_value")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const metricTrend: MetricTrend | null = currentGoal
    ? await loadGoalMetricTrend(supabase, company.id as string, {
        targetMetricKey: currentGoal.target_metric_key as string | null,
        targetMetricValue: currentGoal.target_metric_value as number | null,
      })
    : null;

  let opportunities: { id: string; description: string; readinessStatus: "do_now" | "fix_groundwork_first" | null; readinessReasoning: string | null }[] = [];
  let readiness: { data_quality: number | null; team_skill: number | null; process_maturity: number | null; governance_foundation: number | null } | null = null;
  if (latestReport) {
    const { data: oppRows } = await supabase
      .from("ai_opportunity_synthesis")
      .select("id, opportunity_description, readiness_status, readiness_reasoning")
      .eq("report_id", latestReport.id);
    opportunities = (oppRows ?? []).map((o) => ({
      id: o.id as string,
      description: o.opportunity_description as string,
      readinessStatus: o.readiness_status as "do_now" | "fix_groundwork_first" | null,
      readinessReasoning: o.readiness_reasoning as string | null,
    }));

    const { data: readinessRow } = await supabase
      .from("readiness_scores")
      .select("data_quality, team_skill, process_maturity, governance_foundation")
      .eq("report_id", latestReport.id)
      .maybeSingle();
    readiness = readinessRow as typeof readiness;
  }

  const admin = createAdminClient();
  const { data: activeModuleRequestRows } = await admin
    .from("module_requests")
    .select("id, module_type, status, created_at")
    .eq("company_id", company.id)
    .in("status", ["pending_review", "approved"])
    .order("created_at", { ascending: false });

  const { data: activeSessionRequestRows } = await supabase
    .from("session_requests")
    .select("id, session_type, status, requested_at, scheduled_at")
    .eq("company_id", company.id)
    .neq("session_type", "discovery")
    .in("status", ["requested", "scheduled"])
    .order("requested_at", { ascending: false });

  const { data: sprintRows } = await supabase
    .from("execution_sprints")
    .select("id, status, target_end_date, selected_finding_id, report_id")
    .eq("company_id", company.id)
    // "proposed" added 2026-08-18 — the new leading stage, awaiting the
    // client's own confirm-or-reselect step, is non-terminal too and
    // belongs in "active status" same as "scoped"/"in_progress".
    .in("status", ["proposed", "scoped", "in_progress"])
    .order("start_date", { ascending: false, nullsFirst: false });

  const activeSprint = (sprintRows ?? []).find((s) => s.status === "in_progress") ?? (sprintRows ?? [])[0] ?? null;
  let sprintFindingTitle: string | null = null;
  let sprintTaskCounts: { done: number; total: number } | null = null;
  if (activeSprint) {
    const { data: findingRow } = await supabase
      .from("lens_findings")
      .select("ai_draft, reviewer_edited_content")
      .eq("id", activeSprint.selected_finding_id)
      .maybeSingle();
    const findingContent = (findingRow?.reviewer_edited_content ?? findingRow?.ai_draft) as LensFinding | undefined;
    sprintFindingTitle = findingContent?.title ?? null;

    // No tasks exist yet while 'proposed' — skip the query rather than
    // render a confusing "0 of 0 tasks done."
    if (activeSprint.status !== "proposed") {
      const { data: sprintTasks } = await supabase
        .from("sprint_tasks")
        .select("status")
        .eq("execution_sprint_id", activeSprint.id)
        .neq("reviewer_status", "rejected");
      const total = sprintTasks?.length ?? 0;
      const done = (sprintTasks ?? []).filter((t) => t.status === "done").length;
      sprintTaskCounts = { done, total };
    }
  }

  const hasAnyStatusTiles = (activeModuleRequestRows?.length ?? 0) > 0 || (activeSessionRequestRows?.length ?? 0) > 0 || activeSprint;

  // Real "delivered/completed services" summary counts (item 4) — kept as
  // a lightweight line, not full cards, precisely because the confirmed
  // rule from earlier this pass is that terminal items don't belong in
  // "Active status/requests." Counts every real terminal service ever
  // delivered to this company, not just the latest — matching Reports &
  // History's own "complete historical record" treatment.
  const { count: deliveredReportsCount } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("status", "sent");
  const { count: deliveredModulesCount } = await admin
    .from("module_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("status", "sent");
  const { count: completedSessionsCount } = await supabase
    .from("session_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("status", "completed");
  const { count: completeSprintsCount } = await supabase
    .from("execution_sprints")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("status", "complete");
  const deliveredCount = (deliveredReportsCount ?? 0) + (deliveredModulesCount ?? 0) + (completedSessionsCount ?? 0) + (completeSprintsCount ?? 0);
  const inProgressCount = (activeModuleRequestRows?.length ?? 0) + (activeSessionRequestRows?.length ?? 0) + (activeSprint ? 1 : 0);

  const SESSION_LABELS: Record<string, string> = { discovery: "Discovery Session", delivery: "Delivery Session", f2f_workshop: "F2F Workshop" };
  const SESSION_STATUS_LABELS: Record<string, string> = { requested: "Requested — awaiting scheduling", scheduled: "Scheduled", completed: "Completed", declined: "Declined" };
  const SPRINT_STATUS_LABELS: Record<string, string> = {
    proposed: "Awaiting your confirmation",
    scoped: "Being scoped by your reviewer",
    in_progress: "In progress",
    complete: "Complete",
  };
  // Real explanatory copy per active-request card type (item 9) — one
  // plain-language line saying what the thing IS and what happens next,
  // not just a bare status word.
  const MODULE_EXPLANATION: Record<string, string> = {
    pending_review: "Submitted and waiting for your reviewer to work through it — you'll be notified once it's ready.",
    approved: "Reviewed and approved — your reviewer will deliver the finished result shortly.",
  };
  const SESSION_EXPLANATION: Record<string, string> = {
    requested: "You asked for this call — your reviewer will follow up personally to find a time.",
    scheduled: "Confirmed — check your email for the details, or see the time above.",
  };
  const SPRINT_EXPLANATION: Record<string, string> = {
    proposed: "Your reviewer suggests starting here — confirm it, or pick a different finding you'd marked \"interested in help\" on.",
    scoped: "Your reviewer is drafting a real task breakdown for this — you'll see it once it's ready to start.",
    in_progress: "A bounded, paid implementation engagement fixing this one finding — track task progress on the sprint page.",
  };

  const activeRequestsCount = inProgressCount;
  let headline: string | null = null;
  if (latestReport || activeRequestsCount > 0) {
    const parts: string[] = [];
    if (latestReport) {
      parts.push(`${top3.length} priorit${top3.length === 1 ? "y" : "ies"} identified`);
      if (readiness !== null) {
        parts.push(`${opportunities.length} AI opportunit${opportunities.length === 1 ? "y" : "ies"} flagged`);
      }
    }
    if (activeRequestsCount > 0) {
      parts.push(`${activeRequestsCount} request${activeRequestsCount === 1 ? "" : "s"} in review`);
    }
    headline = `${parts.join(", ")}.`;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">{company.name}&apos;s current state — what&apos;s wrong, what AI could do about it, and what to do right now.</p>

      {/* (3) Client's stated goal, pinned — real, confirmed 2026-08-16.
          Right under the page subtitle so it's visible without scrolling
          or navigating away, not buried only in Business Profile. */}
      {currentGoal?.primary_goal && (
        <p className="mb-6 inline-flex flex-wrap items-center gap-x-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Your goal:</span>
          {GOAL_LABELS[currentGoal.primary_goal as keyof typeof GOAL_LABELS] ?? currentGoal.primary_goal}
          {currentGoal.secondary_goal && (
            <span>· also: {GOAL_LABELS[currentGoal.secondary_goal as keyof typeof GOAL_LABELS] ?? currentGoal.secondary_goal}</span>
          )}
          <Link href="/business-profile" className="ml-1 font-medium text-accent underline hover:text-accent-hover">
            Edit
          </Link>
        </p>
      )}

      {/* (5) Single action banner — the one thing a founder should see
          first, confirmed 2026-08-16. The #1 priority, its real financial
          impact when one is quantified, its real cascade count when it's
          upstream of 2+ other findings, one clear CTA. Renders nothing
          when there's no report yet — NextStepBanner below is the right
          "what to do" answer for that case instead. */}
      {topPriority && (
        <section className="mb-8 rounded-lg border-2 border-accent bg-accent/5 p-5 dark:bg-accent/10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Highest priority right now</p>
          <p className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">{topPriority.finding.title}</p>
          <div className="mb-3 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
            {isUsableFinancialImpact(topPriority.finding.financialImpact) && (
              <p>
                Estimated cost if left unaddressed:{" "}
                <span className="font-semibold">
                  {formatCurrencyRange(
                    topPriority.finding.financialImpact.impactBandLow,
                    topPriority.finding.financialImpact.impactBandHigh,
                    topPriority.finding.financialImpact.currency,
                  )}
                </span>
              </p>
            )}
            {topPriorityCascade && topPriorityCascade.cascadeCount >= 2 && (
              <p title={topPriorityCascade.cascadesToFindingTitles.join(", ")}>
                Fixing this is upstream of <span className="font-semibold">{topPriorityCascade.cascadeCount} other flagged issues</span>.
              </p>
            )}
          </div>
          <LinkButton href={`/reports/${latestReport!.id}`}>Start fixing this</LinkButton>
        </section>
      )}

      {headline && <p className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-50">{headline}</p>}

      {!latestReport && <NextStepBanner journeyStatus={journeyStatus} />}

      {latestReport && (
        <div className="mt-2 space-y-8">
          {/* (2 & 6 & 7) Top 3 Priorities — severity + real per-finding
              financial impact inline under each title, plus a real
              aggregated exposure line across all three when at least one
              is quantified. */}
          <Card title="Top 3 priorities">
            {top3FinancialExposure && (
              <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
                Together, these represent an estimated{" "}
                <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                  {formatCurrencyRange(top3FinancialExposure.low, top3FinancialExposure.high, top3FinancialExposure.currency)}
                </span>{" "}
                in cost/risk exposure
                {top3FinancialExposure.quantifiedCount < top3FinancialExposure.totalCount &&
                  ` (based on ${top3FinancialExposure.quantifiedCount} of ${top3FinancialExposure.totalCount} findings with a quantified estimate)`}
                .
              </p>
            )}
            {top3.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No priorities to show.</p>
            ) : (
              <ol className="list-inside list-decimal space-y-3 text-sm text-neutral-800 dark:text-neutral-200">
                {top3.map((f) => (
                  <li key={f.findingId}>
                    <span>{f.title}</span>
                    <div className="ml-5 mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${SEVERITY_STYLES[f.severity] ?? ""}`}>{f.severity}</span>
                      {isUsableFinancialImpact(f.financialImpact) && (
                        <span className="text-neutral-500 dark:text-neutral-400">
                          Estimated impact: {formatCurrencyRange(f.financialImpact.impactBandLow, f.financialImpact.impactBandHigh, f.financialImpact.currency)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Link href={`/reports/${latestReport.id}`} className="mt-3 inline-block text-sm underline">
              View full report
            </Link>
          </Card>

          <Card
            title="AI Opportunity & Readiness"
            subtitle="Given what we found above, here's where AI could genuinely help — and whether the groundwork exists to try it safely today."
          >
            {readiness === null ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Not generated yet — this runs automatically once your report is fully approved, and can take a little while
                after delivery. Check back soon.
              </p>
            ) : (
              <div className="space-y-4">
                {readiness && (
                  <div className="grid grid-cols-2 gap-3 rounded-md border border-neutral-200 p-3 text-xs dark:border-neutral-800 sm:grid-cols-4">
                    {(
                      [
                        ["data_quality", "Data quality"],
                        ["team_skill", "Team skill"],
                        ["process_maturity", "Process maturity"],
                        ["governance_foundation", "Governance foundation"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <p className="mb-1 font-medium text-neutral-600 dark:text-neutral-400">{label}</p>
                        <div className="flex gap-0.5">
                          {[0, 1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className={`h-1.5 flex-1 rounded-full ${
                                readiness[key] !== null && n <= (readiness[key] as number) ? "bg-accent" : "bg-neutral-200 dark:bg-neutral-700"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {opportunities.length === 0 && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No AI opportunities were identified as safe to pursue right now, based on the readiness scores above —
                    that&apos;s a genuine assessment, not a missing feature.
                  </p>
                )}
                <ul className="space-y-3">
                  {opportunities.map((o) => (
                    <li key={o.id} className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium text-neutral-900 dark:text-neutral-50">{o.description}</span>
                        {o.readinessStatus && (
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              o.readinessStatus === "do_now"
                                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {o.readinessStatus === "do_now" ? "Ready now" : "Fix groundwork first"}
                          </span>
                        )}
                      </div>
                      {o.readinessReasoning && <p className="text-neutral-600 dark:text-neutral-400">{o.readinessReasoning}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <section>
            <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Roadmap status</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["day30", "day60", "day90"] as const).map((bucket, i) => (
                <div key={bucket} className="rounded-md border border-neutral-300 bg-white p-3 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                  <h3 className="mb-2 font-medium text-neutral-900 dark:text-neutral-50">{[30, 60, 90][i]} days</h3>
                  {roadmap[bucket].length === 0 ? (
                    <p className="text-neutral-400 dark:text-neutral-500">Nothing at this horizon</p>
                  ) : (
                    <ul className="space-y-1 text-neutral-800 dark:text-neutral-200">
                      {roadmap[bucket].map((item) => (
                        <li key={item.finding.findingId}>
                          {item.finding.title}
                          {item.cascadeCount >= 2 && (
                            <span className="ml-1.5 text-xs text-accent" title={item.cascadesToFindingTitles.join(", ")}>
                              — fix this first, unlocks {item.cascadeCount} other finding{item.cascadeCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {metricTrend && (
            <section>
              <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Goal metric trend</h2>
              <div className="rounded-md border border-neutral-300 bg-white p-4 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                  {metricTrend.label}
                  {metricTrend.direction === "higher_is_better" ? " (higher is better)" : " (lower is better)"}
                </p>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                  {metricTrend.points.length >= 2 ? (
                    <>
                      {metricTrend.points
                        .map((p) => `${p.value}${metricTrend.unit}`)
                        .join(" → ")}
                      {" "}
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        across {metricTrend.points.length} audits
                      </span>
                    </>
                  ) : (
                    <>
                      Currently {metricTrend.points[0].value}
                      {metricTrend.unit}
                      <span className="ml-1.5 text-xs text-neutral-500 dark:text-neutral-400">— trend will show once you have a second audit with this metric.</span>
                    </>
                  )}
                </p>
                {metricTrend.targetValue !== null && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Your stated target: {metricTrend.targetValue}{metricTrend.unit}</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* (4) Delivered/completed services summary line — real, lightweight,
          not full cards (keeps the "Active status = non-terminal only"
          rule intact from earlier this pass). Only shown when there's
          something real to summarize. */}
      {deliveredCount > 0 && (
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
          {deliveredCount} service{deliveredCount === 1 ? "" : "s"} delivered, {inProgressCount} in progress —{" "}
          <Link href="/reports" className="font-medium text-accent underline hover:text-accent-hover">
            View all in Reports &amp; History
          </Link>
          .
        </p>
      )}

      {/* (9) Your active requests — each card now carries one real
          explanatory line: what this is, what happens next. */}
      {hasAnyStatusTiles && (
        <section className="mt-4">
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Your active requests</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeSprint && (
              <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">Execution Sprint</h3>
                <p className="mb-1 text-neutral-600 dark:text-neutral-400">{sprintFindingTitle ?? "In progress"}</p>
                <p className="mb-1 text-accent">{SPRINT_STATUS_LABELS[activeSprint.status] ?? activeSprint.status}</p>
                <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">{SPRINT_EXPLANATION[activeSprint.status] ?? ""}</p>
                {sprintTaskCounts && (
                  <p className="mb-1 text-neutral-500 dark:text-neutral-400">
                    {sprintTaskCounts.done} of {sprintTaskCounts.total} tasks done
                  </p>
                )}
                <Link href={`/execution-sprint/${activeSprint.id}`} className="mt-1 inline-block underline">
                  View sprint
                </Link>
              </div>
            )}

            {(activeModuleRequestRows ?? []).map((r) => {
              const meta = MODULE_META[r.module_type as ModuleType];
              return (
                <div key={r.id as string} className="rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">{meta?.label ?? r.module_type}</h3>
                  <p className="mb-1 text-accent">{MODULE_STATUS_LABELS[r.status as string] ?? r.status}</p>
                  <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">{MODULE_EXPLANATION[r.status as string] ?? ""}</p>
                  <p className="text-neutral-500 dark:text-neutral-400">Submitted {new Date(r.created_at as string).toLocaleDateString()}</p>
                </div>
              );
            })}

            {(activeSessionRequestRows ?? []).map((r) => (
              <div key={r.id as string} className="rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">{SESSION_LABELS[r.session_type as string] ?? r.session_type}</h3>
                <p className="mb-1 text-accent">{SESSION_STATUS_LABELS[r.status as string] ?? r.status}</p>
                <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">{SESSION_EXPLANATION[r.status as string] ?? ""}</p>
                <p className="text-neutral-500 dark:text-neutral-400">Requested {new Date(r.requested_at as string).toLocaleDateString()}</p>
                {r.scheduled_at && <p className="text-neutral-500 dark:text-neutral-400">Scheduled {new Date(r.scheduled_at as string).toLocaleString()}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <Card title="Services and support" subtitle="Everything Elvanis offers — modules, the Execution Sprint, and reviewer sessions — in one place.">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            Beyond your Core Audit: {MODULE_ORDER.map((mt) => MODULE_META[mt].label).join(", ")}, a paid implementation sprint for
            your top priority, and calls with your reviewer.
          </p>
          <LinkButton href="/services">View all services</LinkButton>
        </Card>
      </section>
    </div>
  );
}

/**
 * Item 10 note, confirmed 2026-08-16: every remaining top-level section was
 * checked against "what should I do / what happened" before deciding
 * whether to remove it — none were found to be purely informational with
 * zero action or explanation once items 3/4/7/8/9 above were added. AI
 * Opportunity & Readiness already tells the client what to do (readiness
 * status per opportunity); Roadmap already frames itself as "what to do,
 * over time"; Goal metric trend is itself a real "what happened" answer
 * (real numeric progression); "Your active requests" cards now carry a
 * real explanatory line each (item 9); Services and support has a real
 * action (View all services). Disclosed explicitly rather than silently
 * claiming a removal that didn't happen — the bar was applied, nothing
 * failed it.
 */
