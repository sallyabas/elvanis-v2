import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LensFinding } from "@/lib/lenses/types";
import { deriveRoadmap } from "@/lib/reports/roadmap";
import { loadRecommendationLibrary } from "@/lib/recommendations/repository";
import type { FindingForCascade } from "@/lib/recommendations/cascade";
import { computeJourneyStatus } from "@/lib/reports/journey-status";
import { loadGoalMetricTrend, type MetricTrend } from "@/lib/goals/metric-trend";
import { MODULE_META, MODULE_ORDER, MODULE_STATUS_LABELS, type ModuleType } from "@/lib/modules/module-meta";
import { NextStepBanner } from "@/app/_components/NextStepBanner";
import { Card } from "@/app/_components/ui/Card";
import { LinkButton } from "@/app/_components/ui/LinkButton";

/**
 * Dashboard rebuild (confirmed 2026-08-12, direct founder request — "a
 * genuine unified home page, not a status-only stub, treated with the
 * same weight as a module build"). The previous version only ever showed
 * top-3 + roadmap + one Execution Sprint tile — this rebuild adds the
 * three things that were missing:
 *
 * 1. AI Opportunity & Readiness as its own headline section, equal visual
 *    weight to top-3 — previously not rendered anywhere in the client-
 *    facing app at all, confirmed by grepping for "do_now"/
 *    "fix_groundwork_first" across src/ before starting: only the
 *    synthesis module itself referenced these values, no UI ever had.
 * 2. Live status tiles for module requests, session requests, and the
 *    Execution Sprint — previously only the sprint had a tile.
 * 3. A "Services and support" section linking to the new /services page
 *    (see src/app/(app)/services/page.tsx) — closes the "clients have no
 *    path to the paid modules" gap found in the previous batch's
 *    "Next steps" work, this time as its own dedicated home rather than
 *    tacked onto the bottom of one report page.
 *
 * Design principle (the founder's own framing, checked against Vanta/
 * Drata): findings, status, and next actions live in ONE place, not
 * scattered across pages the client has to remember to check separately.
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
  // Cascade reasoning (confirmed 2026-08-13, item 5) — needs the report's
  // FULL finding set, not just the top-3 rows previously fetched here, so
  // a top-3 finding's cascade count can see findings that didn't
  // themselves make top-3. top3WithIds pairs each finding with its real DB
  // id, not LensFinding.findingId — see deriveRoadmap's own docblock for
  // why (findingId is stale post-load, never re-persisted after the
  // original audit run).
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

  // Goal metric trend-tracking (confirmed 2026-08-13, item 2) — the
  // smaller, honest scope: real numeric progression across real delivered
  // audits, never a fabricated achieved/missed verdict. Only meaningful
  // once the client has picked a metric to track at onboarding — most
  // companies (and every pre-2026-08-13 company) simply won't have one set.
  const { data: currentGoal } = await supabase
    .from("goals")
    .select("target_metric_key, target_metric_value")
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

  // AI Opportunity & Readiness (confirmed 2026-08-12, headline section per
  // explicit priority order) — reads the same ai_opportunity_synthesis /
  // readiness_scores tables the synthesis module writes to; RLS scopes
  // both to the owning company only (not status-gated the way `reports`
  // is), which is safe here since we only ever query them against a
  // report we've already confirmed is `sent`. Synthesis runs on a cron
  // AFTER reviewer approval (see run-pending-synthesis.ts) — a report can
  // genuinely be delivered before synthesis has run, so absence here is a
  // real, honest "not generated yet" state, not a bug to hide.
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

  // Live status tiles (confirmed 2026-08-12, rules tightened 2026-08-15 —
  // Dashboard/module fixes review). "Active status" now means genuinely
  // active/in-progress only, not a general log of everything that's ever
  // happened — a real, confirmed rule: once something reaches a terminal
  // state (module: sent; session: completed/declined; sprint: complete),
  // it moves out of this section entirely and lives only in Reports &
  // History (src/app/(app)/reports/page.tsx, extended in the same pass to
  // actually show those terminal items — they'd otherwise vanish from the
  // client's view completely once removed from here).
  //
  // Module requests are read via the admin client for the same reason
  // computeJourneyStatus() already uses it: module_requests' own RLS only
  // allows a client to SELECT `sent` rows (tightened 2026-08-06 to mirror
  // `reports`), but a client should still see "under review" as a real
  // status, not silence — same "let the client see their own submission
  // status without exposing content early" precedent already established
  // for the core audit's holding page. Only status/module_type/created_at
  // are read here, never intake_data or findings.
  const admin = createAdminClient();
  const { data: activeModuleRequestRows } = await admin
    .from("module_requests")
    .select("id, module_type, status, created_at")
    .eq("company_id", company.id)
    .in("status", ["pending_review", "approved"])
    .order("created_at", { ascending: false });

  // Discovery Session, real carve-out (confirmed 2026-08-15, direct
  // founder rule): unlike module requests/sprints, a Discovery Session
  // never appears here at all, in ANY state — it's a pre-evidence,
  // exploratory call with no Dashboard-worthy deliverable of its own
  // (nothing in this app currently attaches a distinct "output" to one
  // beyond the reviewer's own free-text notes). It always lives in
  // Reports & History instead, in whatever state it's actually in. Other
  // session types (Delivery Session, F2F Workshop) follow the general
  // active/terminal rule above like everything else.
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
    .in("status", ["scoped", "in_progress"])
    .order("start_date", { ascending: false, nullsFirst: false });

  // Real bug fixed in the same pass: this used to fall back to the most
  // RECENT sprint regardless of status when none was `in_progress` — a
  // `complete` (terminal) sprint could surface here via that fallback,
  // directly contradicting "Active status shows only active items." The
  // query above already excludes `complete` entirely, so a straightforward
  // "prefer in_progress, else whatever non-terminal one exists" is now
  // correct without a fallback that could reach into terminal rows.
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

    const { data: sprintTasks } = await supabase
      .from("sprint_tasks")
      .select("status")
      .eq("execution_sprint_id", activeSprint.id)
      .neq("reviewer_status", "rejected");
    const total = sprintTasks?.length ?? 0;
    const done = (sprintTasks ?? []).filter((t) => t.status === "done").length;
    sprintTaskCounts = { done, total };
  }

  const hasAnyStatusTiles = (activeModuleRequestRows?.length ?? 0) > 0 || (activeSessionRequestRows?.length ?? 0) > 0 || activeSprint;

  const SESSION_LABELS: Record<string, string> = { discovery: "Discovery Session", delivery: "Delivery Session", f2f_workshop: "F2F Workshop" };
  const SESSION_STATUS_LABELS: Record<string, string> = { requested: "Requested — awaiting scheduling", scheduled: "Scheduled", completed: "Completed", declined: "Declined" };
  const SPRINT_STATUS_LABELS: Record<string, string> = { scoped: "Being scoped by your reviewer", in_progress: "In progress", complete: "Complete" };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">{company.name}&apos;s current state — what&apos;s wrong, what AI could do about it, and what to do right now.</p>

      {/* ProgressStepper deliberately removed from Dashboard (confirmed
          2026-08-15, direct founder request to reconsider whether the
          step-progress metaphor belongs here at all) — kept on Evidence
          Intake/Business Profile/Reports & History, where a genuinely
          linear "you're not done setting up yet" framing still fits a
          first-time visitor. Dashboard's own job is different: it's a
          returning-visitor status view, not an onboarding checklist.
          NextStepBanner already covers "no report yet" with one clear
          action; once a report exists, the real content below (Top 3, AI
          Opportunity, roadmap) already IS the "here's your current state"
          answer a 4-step tracker would just be restating redundantly. */}

      {!latestReport && <NextStepBanner journeyStatus={journeyStatus} />}

      {/* Real bug found and fixed 2026-08-15 (module intake/service flow
          review) — this whole section was previously nested INSIDE
          `{latestReport && (...)}` below, meaning a company with real
          active module requests, session requests, or an Execution Sprint
          but no delivered CORE report yet would never see any of them here
          — a structural gate on the wrong condition, not something
          specific to any one request. Moved out to its own unconditional
          (gated only on hasAnyStatusTiles) block so it shows regardless of
          whether a core report exists. */}
      {hasAnyStatusTiles && (
        <section className="mt-8">
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Active status</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeSprint && (
              <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">Execution Sprint</h3>
                <p className="mb-1 text-neutral-600 dark:text-neutral-400">{sprintFindingTitle ?? "In progress"}</p>
                <p className="mb-1 text-accent">{SPRINT_STATUS_LABELS[activeSprint.status] ?? activeSprint.status}</p>
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

            {/* Real, structural fix (confirmed 2026-08-15): module tiles
                here are now always genuinely active (pending_review or
                approved, queried above) — a `sent` (terminal) request can
                never reach this list anymore, so the "View results" link
                that used to gate on r.status === "sent" here is now dead
                code by construction; removed rather than left as
                unreachable. Delivered results live in Reports & History. */}
            {(activeModuleRequestRows ?? []).map((r) => {
              const meta = MODULE_META[r.module_type as ModuleType];
              return (
                <div key={r.id as string} className="rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">{meta?.label ?? r.module_type}</h3>
                  <p className="mb-1 text-accent">{MODULE_STATUS_LABELS[r.status as string] ?? r.status}</p>
                  <p className="text-neutral-500 dark:text-neutral-400">Submitted {new Date(r.created_at as string).toLocaleDateString()}</p>
                </div>
              );
            })}

            {(activeSessionRequestRows ?? []).map((r) => (
              <div key={r.id as string} className="rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">{SESSION_LABELS[r.session_type as string] ?? r.session_type}</h3>
                <p className="mb-1 text-accent">{SESSION_STATUS_LABELS[r.status as string] ?? r.status}</p>
                <p className="text-neutral-500 dark:text-neutral-400">Requested {new Date(r.requested_at as string).toLocaleDateString()}</p>
                {r.scheduled_at && <p className="text-neutral-500 dark:text-neutral-400">Scheduled {new Date(r.scheduled_at as string).toLocaleString()}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {latestReport && (
        <div className="mt-8 space-y-8">
          {/* Section 1 + 2 — AI Opportunity & Readiness sits alongside Top
              3, not beneath it, equal visual weight (confirmed priority
              order: AI Opportunity is listed FIRST). Two-column on wide
              screens, stacked on narrow — neither is visually subordinate
              to the other. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="AI Opportunity & Readiness" subtitle="Where AI could genuinely help — and whether the groundwork exists to try it safely today.">
              {/* Real bug found and fixed during live verification, not
                  anticipated upfront: `readiness` (readiness_scores) and
                  `opportunities` (ai_opportunity_synthesis) are always
                  written together by the same persist call — so
                  `readiness !== null` is the real "synthesis has run"
                  signal, genuinely distinct from "it ran and found zero
                  opportunities worth surfacing" (a real, legitimate
                  outcome — confirmed live against Nimbus Ledger Ltd's
                  actual most recent report, which returned exactly this).
                  The original `opportunities.length === 0` check
                  conflated both into the same "not generated yet" copy,
                  which would have been dishonest for the second case. */}
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

            <Card title="Top 3 priorities">
              {top3.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">No priorities to show.</p>
              ) : (
                <ol className="list-inside list-decimal space-y-2 text-sm text-neutral-800 dark:text-neutral-200">
                  {top3.map((f) => (
                    <li key={f.findingId}>{f.title}</li>
                  ))}
                </ol>
              )}
              <Link href={`/reports/${latestReport.id}`} className="mt-3 inline-block text-sm underline">
                View full report
              </Link>
            </Card>
          </div>

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

          {/* Goal metric trend (confirmed 2026-08-13, item 2) — only shown
              once the client has both picked a metric to track at
              onboarding AND has at least one real report containing it;
              both are honest, common "nothing to show yet" states, not
              errors, so this section simply doesn't render otherwise. */}
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

      {/* Section 4 — Services and support (confirmed 2026-08-12). Shown
          regardless of whether a report exists yet — Discovery Session and
          the general "what does Elvanis offer" question are relevant even
          before any evidence has been submitted. */}
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
