import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LensFinding, LensType, Severity } from "@/lib/lenses/types";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import { deriveRoadmap } from "@/lib/reports/roadmap";
import { formatCurrencyRange, isUsableFinancialImpact } from "@/lib/reports/financial-impact";
import { loadRecommendationLibrary } from "@/lib/recommendations/repository";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { SprintInterestButton } from "@/app/_components/SprintInterestButton";
import { FindingNotApplicableButton } from "@/app/_components/FindingNotApplicableButton";
import { loadFlaggedFindingIds } from "@/lib/reports/finding-feedback";
import { EvidenceSubmittedDisclosure, type EvidenceSnapshotShape } from "@/app/_components/EvidenceSubmittedDisclosure";
import { loadGovernanceDimensions } from "@/lib/lenses/benchmarks-repository";
import { getTotalTurnaroundHours } from "@/lib/reports/sla";
import { listPricing } from "@/lib/pricing";
import { Card } from "@/app/_components/ui/Card";
import { Alert } from "@/app/_components/ui/Alert";

// SourceEvidenceSnapshot renamed to the shared EvidenceSnapshotShape
// (confirmed 2026-08-12, real bug list item #4) — this type/rendering was
// extracted into src/app/_components/EvidenceSubmittedDisclosure.tsx so
// the evidence-intake page's locked view can show a client the same real
// content while their submission is still in flight, not only after a
// report is fully delivered. See that file's own docblock.
type SourceEvidenceSnapshot = EvidenceSnapshotShape;

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
    .select("id, status, company_id, submitted_at, edit_window_closes_at, companies(user_id)")
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

    // Simplified 2026-08-10 for the delayed-execution architecture — the
    // real "still within the edit window" branch this page used to have
    // is now genuinely dead code, not just unlikely: a `reports` row is
    // only ever created by run-pending-audits.ts, which only ever runs
    // AFTER edit_window_closes_at has passed (see that file's own
    // docblock). So by construction, any report reaching this branch
    // already has a closed window and a completed audit — there is no
    // more "still editable" state to render here at all. Editing now
    // genuinely happens earlier, before any report exists — see
    // evidence-intake/page.tsx and NextStepBanner for that flow.
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card className="text-center">
          <h1 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Your report is being reviewed</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            We&apos;ll have this ready within{" "}
            {totalHours}{" "}
            hours of your original submission, and we&apos;ll email you the moment it&apos;s ready — no need to
            keep checking back.
          </p>
        </Card>
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
  // Cascade reasoning (confirmed 2026-08-13, item 5) — allReportFindings is
  // the FULL visible finding set for this report, not just the top 3, so
  // cascade counting can see everything a top-3 finding might be upstream
  // of, including findings that didn't themselves make top-3.
  const recommendationLibrary = await loadRecommendationLibrary();
  const allReportFindings = visibleFindings.map((f) => ({ id: f.id, lens: f.lens, title: displayedContent(f).title, diagnosis: displayedContent(f).diagnosis }));
  // Paired with the real DB id, not LensFinding.findingId — see
  // deriveRoadmap's own docblock for the real, pre-existing bug this works
  // around (findingId is stale, never re-persisted post-audit).
  const top3WithIds = visibleFindings.filter((f) => top3FindingIds.has(f.id)).map((f) => ({ id: f.id, finding: displayedContent(f) }));
  const roadmap = deriveRoadmap(top3WithIds, allReportFindings, recommendationLibrary);

  const byLens = new Map<LensType, FindingRow[]>();
  for (const f of visibleFindings) {
    byLens.set(f.lens, [...(byLens.get(f.lens) ?? []), f]);
  }

  // Surface real strengths, per-lens (confirmed 2026-08-14, item 6 of the
  // old-Elvanis-inspired batch) — the report was previously entirely
  // deficit-framed. `goalRelevance === "directly_supports"` is already the
  // real, deterministic "this finding is genuinely healthy and directly
  // relevant to the goal" signal every lens's prompt already produces (see
  // GoalRelevance's own docblock in lenses/types.ts) — reused here as the
  // strength signal rather than inventing a new judgment. Missing-evidence
  // findings are excluded from both counts — an evidence gap is neither a
  // strength nor a weakness, a third, separate category this report
  // already visually distinguishes elsewhere (the dashed "NO EVIDENCE
  // SUBMITTED" card). AI & Governance's own prompt rule 4 forbids ever
  // producing a "things are healthy" finding by design, so it will
  // structurally show 0 strengths here — correct, not a bug, per the
  // founder's own explicit confirmation.
  const strengthsByLens = new Map<LensType, { strengths: number; weaknesses: number }>();
  for (const lens of LENS_ORDER) {
    const rows = (byLens.get(lens) ?? []).filter((r) => !displayedContent(r).isMissingDataFinding);
    const strengths = rows.filter((r) => displayedContent(r).goalRelevance === "directly_supports").length;
    strengthsByLens.set(lens, { strengths, weaknesses: rows.length - strengths });
  }
  const strengthFindings = visibleFindings.filter((f) => !displayedContent(f).isMissingDataFinding && displayedContent(f).goalRelevance === "directly_supports");

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

  // Real gap found and closed (confirmed 2026-08-12, direct founder
  // request to expand "Next steps") — a signed-in client had NO way
  // whatsoever to reach any of the three standalone modules (Tender
  // Readiness, AI Reliability Audit, Data Protection Compliance): no nav
  // link anywhere in the (app) layout, and the module pages themselves are
  // still `?companyId=`-addressed (the same interim pre-client-auth
  // pattern documented in CLAUDE.md), not session-resolved — real
  // revenue-bearing products (£2,000–£2,500 each) that were completely
  // unreachable through the actual product. Fixed at the point this page
  // already has `company.id` available: real links with the real
  // DB-backed price, using the same interim `?companyId=` pattern the
  // pages already expect (modernizing those pages to resolve the company
  // from session directly is a separate, larger piece, not done here).
  const pricing = await listPricing();
  const modulePricing = (itemKey: string) => pricing.find((p) => p.itemKey === itemKey);

  // Client-facing Execution Sprint interest (confirmed 2026-08-06, honest
  // UX review pass) — see sprint_interest_requests migration docblock.
  // Session-scoped, not admin (RLS already restricts to the caller's own
  // company) — a finding with any existing request (open or resolved)
  // shows "requested" instead of the button again, avoiding duplicate spam.
  const { data: existingSprintInterest } = await supabase.from("sprint_interest_requests").select("finding_id").eq("report_id", reportId);
  const requestedFindingIds = new Set((existingSprintInterest ?? []).map((r) => r.finding_id as string));

  // Real "Does not apply to us" feedback (confirmed 2026-08-16, final
  // Dashboard redesign pass, item 2) — a correctness signal, deliberately
  // separate from the sprint-interest choices above, which are about
  // acting on a finding rather than flagging it as simply wrong.
  const flaggedFindingIds = await loadFlaggedFindingIds(company.id as string);

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
      )}

      {byLens.size > 0 && (
        <section className="mb-10 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-1 text-lg font-medium">Strengths by lens</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            This report also looks for what&apos;s genuinely working, not just what needs fixing — a lens with no bar segment here didn&apos;t identify a
            finding directly and healthily supporting your stated goal this time, not that nothing about it works.
          </p>
          <div className="space-y-3">
            {LENS_ORDER.filter((lens) => byLens.has(lens)).map((lens) => {
              const counts = strengthsByLens.get(lens) ?? { strengths: 0, weaknesses: 0 };
              const total = counts.strengths + counts.weaknesses;
              const strengthPercent = total > 0 ? (counts.strengths / total) * 100 : 0;
              return (
                <div key={lens}>
                  <div className="mb-1 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                    <span>{LENS_LABELS[lens]}</span>
                    <span>
                      {counts.strengths} strength{counts.strengths === 1 ? "" : "s"} · {counts.weaknesses} to address
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    {total === 0 ? null : (
                      <>
                        <div className="bg-green-500" style={{ width: `${strengthPercent}%` }} />
                        <div className="bg-neutral-300 dark:bg-neutral-600" style={{ width: `${100 - strengthPercent}%` }} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {strengthFindings.length > 0 && (
            <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <h3 className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">What&apos;s working</h3>
              <ul className="space-y-1.5 text-sm">
                {strengthFindings.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-neutral-700 dark:text-neutral-300">
                    <span className="mt-0.5 text-green-600 dark:text-green-400">✓</span>
                    <span>{displayedContent(f).title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                    ) : null}
                    {!f.isMissingDataFinding && (
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
                  {/* Real gap closed (confirmed 2026-08-12, direct founder
                      request) — every "no evidence submitted" finding
                      previously relied on the reader remembering the one
                      generic note at the bottom of the page. Each finding
                      now gets its own inline, clearly-labeled path, since
                      the reader is looking at exactly the gap right here. */}
                  {f.isMissingDataFinding && (
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <Link href="/evidence-intake" className="font-medium text-accent underline hover:text-accent-hover">
                        Add this evidence
                      </Link>{" "}
                      — starts a new, paid re-audit cycle (your free audit has already been used).
                    </p>
                  )}
                  {isUsableFinancialImpact(f.financialImpact) && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Estimated impact: {formatCurrencyRange(f.financialImpact.impactBandLow, f.financialImpact.impactBandHigh, f.financialImpact.currency)}
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
                  {/* Real "Does not apply to us" feedback (confirmed
                      2026-08-16) — a correctness signal, not an action
                      choice, so it's shown regardless of severity (unlike
                      SprintInterestButton above) and never on
                      isMissingDataFinding rows — there's no finding to
                      dispute when the gap is "you didn't submit evidence." */}
                  {!f.isMissingDataFinding && (
                    <FindingNotApplicableButton
                      companyId={company.id}
                      findingSource="lens_finding"
                      findingId={row.id}
                      findingTitle={f.title}
                      alreadyFlagged={flaggedFindingIds.has(row.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Real gap fixed, confirmed 2026-08-12 (empty-state audit following
          the Reports & History fix) — this was a single bare, unstyled
          line with no visual weight, easy to mistake for a rendering
          error rather than an honest (rare) edge case: every finding on
          this delivered report was rejected during review. Given real
          visual weight via the shared Alert component, same as every
          other message surface swept in the app-wide message-design pass. */}
      {visibleFindings.length === 0 && (
        <Alert variant="info">
          None of this report&apos;s findings are currently visible — every one was removed during review.
        </Alert>
      )}

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

        {/* Real gap found and closed (confirmed 2026-08-12, direct founder
            request to expand "Next steps" beyond the original 2 options)
            — see the modulePricing() docblock above. Each links using the
            same interim `?companyId=` pattern those pages already expect. */}
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="mb-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">Other audits available</h3>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Standalone, sold separately from this Core Audit — each has its own findings and reviewer pass.
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/tender-readiness" className="font-medium text-accent underline hover:text-accent-hover">
                Tender Readiness
              </Link>
              {modulePricing("tender_readiness") && (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {" "}
                  — {modulePricing("tender_readiness")!.currency} {modulePricing("tender_readiness")!.priceAmount}, AI-specific regulatory risk
                  classification and procurement-readiness content
                </span>
              )}
            </li>
            <li>
              <Link href="/ai-reliability-audit" className="font-medium text-accent underline hover:text-accent-hover">
                AI Reliability Audit
              </Link>
              {modulePricing("ai_reliability_audit") && (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {" "}
                  — {modulePricing("ai_reliability_audit")!.currency} {modulePricing("ai_reliability_audit")!.priceAmount}, adversarial testing
                  against documented real-world AI failure patterns
                </span>
              )}
            </li>
            <li>
              <Link href="/data-protection-compliance" className="font-medium text-accent underline hover:text-accent-hover">
                Data Protection Compliance
              </Link>
              {modulePricing("data_protection_compliance") && (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {" "}
                  — {modulePricing("data_protection_compliance")!.currency} {modulePricing("data_protection_compliance")!.priceAmount},
                  GDPR/PDPL readiness across consent, retention, and breach response
                </span>
              )}
            </li>
          </ul>
        </div>

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
          <EvidenceSubmittedDisclosure evidenceSnapshot={evidenceSnapshot} governanceDimensions={governanceDimensions} />
        </section>
      )}
    </div>
  );
}
