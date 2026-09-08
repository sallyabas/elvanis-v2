import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadActivePendingEvidenceSubmission } from "@/lib/evidence/pending-submission";
import { loadServiceStatusRecords } from "@/lib/reviewer/service-status";
import { isContactSalesSessionType, SESSION_TYPE_PRICING_KEY } from "@/lib/reviewer/service-status-types";
import { listReviewerNotes, type ReviewerNote } from "@/lib/reviewer/reviewer-notes";
import { listPricing } from "@/lib/pricing";
import { MODULE_META, type ModuleType } from "@/lib/modules/module-meta";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import type { PaymentEntityType } from "@/lib/reviewer/payment-records";
import { TypeBadge, moduleTypeToItemType, sessionTypeToItemType } from "@/lib/item-type-badge";
import { humanizeStatus, SESSION_STATUS_LABELS } from "@/lib/format";
import { computeDisplayStatus } from "@/lib/reviewer/unified-requests";
import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { setPilotClientAction } from "./actions";
import { ContactSalesStatusRow } from "./ContactSalesStatusRow";
import { ReviewerNotesPanel } from "./ReviewerNotesPanel";
import { RequestDetailsUnit } from "./RequestDetailsUnit";

/**
 * Reviewer company-context view (confirmed 2026-08-11, live testing pass;
 * fully reorganized 2026-09-08, final status-flow spec, item 6). Real
 * per-request grouping, not per-type flat lists — each individual real
 * request (a Core Audit report, a re-audit, a module request, a Sprint, a
 * session) renders as its own self-contained unit, carrying its own
 * status, price (where applicable), reviewer notes, and (for reports/
 * modules, which have real findings) finding feedback — all together,
 * rather than four separate company-wide sections a reviewer had to
 * mentally cross-reference. Auth/role gating handled entirely by
 * (reviewer)/layout.tsx (this route sits inside that group).
 *
 * Three groups, confirmed structure:
 *   1. Company Profile — unchanged (Business profile + Goal).
 *   2. Activity & Requests — every real request, one self-contained unit
 *      each. Terminal/historical requests (delivered/completed/canceled/
 *      refunded) collapse into a closed <details> by default — real
 *      client histories run 8+ requests deep (confirmed by reading real
 *      data, not assumed), and rendering all of it always-expanded would
 *      be the exact clutter this reorganization exists to fix. Active/
 *      recent requests stay expanded.
 *   3. General Reviewer Notes — only notes with no request association
 *      (relatedEntityType/Id both null) — genuinely general observations,
 *      not tied to any single request. Every note created before this
 *      migration lands here by construction (no fabricated backfill).
 *
 * Pilot client kept as a small, compact toggle directly under the H1 —
 * a company-level reviewer flag, not naturally part of any of the 3
 * named groups; placement is a disclosed judgment call, not silently
 * decided (see the 2026-09-08 build report for the full reasoning).
 *
 * payment_records/PaymentStatusRow removed entirely (2026-09-08, item 4);
 * ServiceStatusRow removed from reports/sessions/sprints (item 5) — both
 * superseded by the real payment-gate status + this reorganization's own
 * per-request ReviewerNotesPanel instances, which is exactly the
 * "completion-note replacement" that removal deferred to this pass.
 *
 * finding_feedback grouped by real parent request (2026-09-08) — that
 * table only stores finding_source/finding_id, no direct report/request
 * link; resolved here via two small, batched lookup queries
 * (lens_findings.report_id / module_findings.request_id), no schema
 * change needed.
 */

interface FeedbackRow {
  id: string;
  finding_source: string;
  finding_title: string;
  created_at: string;
}

/** service_type -> service_status_records status, defaulting to 'requested' for a row with no record yet (mirrors the old inline logic). */
function isTerminal(kind: "report" | "reaudit" | "module" | "sprint" | "session", status: string): boolean {
  switch (kind) {
    case "report":
    case "reaudit":
      return status === "sent" || status === "canceled";
    case "module":
      return status === "sent" || status === "canceled";
    case "sprint":
      return status === "complete" || status === "canceled";
    case "session":
      return status === "completed" || status === "declined" || status === "refunded";
  }
}

function NotesAndFeedback({
  companyId,
  entityType,
  entityId,
  notesByEntity,
  feedbackByEntity,
}: {
  companyId: string;
  entityType: PaymentEntityType;
  entityId: string;
  notesByEntity: Map<string, ReviewerNote[]>;
  feedbackByEntity: Map<string, FeedbackRow[]>;
}) {
  const key = `${entityType}:${entityId}`;
  const notes = notesByEntity.get(key) ?? [];
  const feedback = feedbackByEntity.get(key) ?? [];
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Reviewer notes for this request</p>
        <ReviewerNotesPanel companyId={companyId} notes={notes} relatedEntityType={entityType} relatedEntityId={entityId} addLabel="+ Add a note about this request" />
      </div>
      {feedback.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            &quot;Does this apply to us?&quot; feedback on this request&apos;s findings
          </p>
          <ul className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
            {feedback.map((f) => (
              <li key={f.id}>
                {f.finding_title} · flagged {new Date(f.created_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function ReviewerCompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const admin = createAdminClient();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select(
      "id, name, industry, business_model, employee_count, stage, website_url, revenue_range_band, customer_type, team_structure_summary, registration_country, uae_free_zone, customer_market_countries, difc_stable_arrangements, is_pilot_client",
    )
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) notFound();

  const { data: goals } = await admin
    .from("goals")
    .select("id, primary_goal, secondary_goal, urgency_level, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const { data: reports } = await admin
    .from("reports")
    .select("id, status, submitted_at, delivered_at, rerun_of_report_id")
    .eq("company_id", companyId)
    .order("submitted_at", { ascending: false });

  const { data: moduleRequests } = await admin
    .from("module_requests")
    .select("id, module_type, status, payment_status, cancellation_reason, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const { data: sessionRequests } = await admin
    .from("session_requests")
    .select("id, session_type, status, requested_at, scheduled_at, completed_at, phone_snapshot, reviewer_notes")
    .eq("company_id", companyId)
    .order("requested_at", { ascending: false });

  const { data: executionSprints } = await admin
    .from("execution_sprints")
    .select("id, status, payment_status, cancellation_reason, start_date, target_end_date, report_id")
    .eq("company_id", companyId)
    .order("id", { ascending: false });

  // Real finding feedback, resolved to its real parent request (confirmed
  // 2026-09-08) — finding_feedback only stores finding_source/finding_id,
  // no direct link; resolved via two small, batched lookups, no schema
  // change needed. See this file's own top docblock.
  const { data: rawFeedback } = await admin
    .from("finding_feedback")
    .select("id, finding_source, finding_id, finding_title, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  const lensFeedbackIds = (rawFeedback ?? []).filter((f) => f.finding_source === "lens_finding").map((f) => f.finding_id as string);
  const moduleFeedbackIds = (rawFeedback ?? []).filter((f) => f.finding_source === "module_finding").map((f) => f.finding_id as string);
  const [{ data: lensFindingsForFeedback }, { data: moduleFindingsForFeedback }] = await Promise.all([
    lensFeedbackIds.length > 0
      ? admin.from("lens_findings").select("id, report_id").in("id", lensFeedbackIds)
      : Promise.resolve({ data: [] as { id: string; report_id: string }[] }),
    moduleFeedbackIds.length > 0
      ? admin.from("module_findings").select("id, request_id").in("id", moduleFeedbackIds)
      : Promise.resolve({ data: [] as { id: string; request_id: string }[] }),
  ]);
  const reportIdByFindingId = new Map((lensFindingsForFeedback ?? []).map((f) => [f.id, f.report_id]));
  const moduleRequestIdByFindingId = new Map((moduleFindingsForFeedback ?? []).map((f) => [f.id, f.request_id]));
  const feedbackByEntity = new Map<string, FeedbackRow[]>();
  for (const f of rawFeedback ?? []) {
    const isLens = f.finding_source === "lens_finding";
    const parentId = isLens ? reportIdByFindingId.get(f.finding_id as string) : moduleRequestIdByFindingId.get(f.finding_id as string);
    if (!parentId) continue; // orphaned feedback (parent finding/report since deleted) — skip gracefully, don't crash the page over stale data.
    const key = `${isLens ? "report" : "module_request"}:${parentId}`;
    feedbackByEntity.set(key, [...(feedbackByEntity.get(key) ?? []), f as FeedbackRow]);
  }

  // Service status (Contact Sales' own real flow) and pricing — unchanged from before this reorganization.
  const [sessionServiceStatus, pricing, allReviewerNotes] = await Promise.all([
    loadServiceStatusRecords("session_request", (sessionRequests ?? []).map((s) => s.id as string)),
    listPricing(),
    listReviewerNotes(companyId),
  ]);
  const pricingByKey = new Map(pricing.map((p) => [p.itemKey, p.priceAmount]));

  // Real per-request note grouping (confirmed 2026-09-08) — general notes
  // (relatedEntityType/Id both null) go to Group 3; every other note is
  // keyed by its own real association for Group 2's per-unit panels.
  const notesByEntity = new Map<string, ReviewerNote[]>();
  const generalNotes: ReviewerNote[] = [];
  for (const n of allReviewerNotes) {
    if (n.relatedEntityType && n.relatedEntityId) {
      const key = `${n.relatedEntityType}:${n.relatedEntityId}`;
      notesByEntity.set(key, [...(notesByEntity.get(key) ?? []), n]);
    } else {
      generalNotes.push(n);
    }
  }

  const activePendingSubmission = await loadActivePendingEvidenceSubmission(companyId);
  const { data: canceledReaudits } = await admin
    .from("pending_evidence_submissions")
    .select("id, submitted_at, cancellation_reason")
    .eq("company_id", companyId)
    .eq("status", "canceled")
    .order("submitted_at", { ascending: false });

  function fmt(d: string | null | undefined): string {
    return d ? new Date(d).toLocaleDateString() : "—";
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/queue" className="mb-4 inline-block text-sm text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200">
        ← Back to queue
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{company.name}</h1>
        {/* Pilot client — a company-level reviewer flag, kept compact,
            placed here rather than inside any of the 3 named groups
            (disclosed judgment call, see this file's own top docblock). */}
        <form action={setPilotClientAction.bind(null, company.id as string, !company.is_pilot_client)}>
          <Button variant="secondary" className="px-2 py-1 text-xs">
            {company.is_pilot_client ? "★ Pilot client (unmark)" : "☆ Mark as pilot client"}
          </Button>
        </form>
      </div>

      <div className="space-y-8">
        {/* ── Group 1: Company Profile ── */}
        <section className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Company Profile</h2>
          <Card title="Business profile">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["Industry", company.industry],
                  ["Business model", company.business_model],
                  ["Stage", company.stage],
                  ["Employee count", company.employee_count],
                  ["Revenue band", company.revenue_range_band],
                  ["Customer type", company.customer_type],
                  ["Website", company.website_url],
                  ["Registration country", company.registration_country],
                  ["UAE free zone", company.uae_free_zone],
                  ["Customer markets", (company.customer_market_countries as string[] | null)?.join(", ")],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
                  <dd className={value ? "text-neutral-800 dark:text-neutral-200" : "italic text-neutral-400"}>{value || "Not provided"}</dd>
                </div>
              ))}
              {company.team_structure_summary && (
                <div className="sm:col-span-2">
                  <dt className="text-neutral-500 dark:text-neutral-400">Team structure</dt>
                  <dd className="text-neutral-800 dark:text-neutral-200">{company.team_structure_summary}</dd>
                </div>
              )}
            </dl>
            {company.difc_stable_arrangements && (
              <div className={`mt-3 rounded-md p-2 text-xs ${company.difc_stable_arrangements === "not_sure" ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "text-neutral-500 dark:text-neutral-400"}`}>
                DIFC stable arrangements: <span className="font-medium">{company.difc_stable_arrangements === "not_sure" ? "Not sure — flagged for follow-up" : company.difc_stable_arrangements}</span>
              </div>
            )}
          </Card>

          <Card title="Goal">
            {goals && goals.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {goals.map((g) => (
                  <li key={g.id} className="text-neutral-800 dark:text-neutral-200">
                    <span className="font-medium">{GOAL_LABELS[g.primary_goal as PrimaryGoal] ?? g.primary_goal}</span>
                    {g.secondary_goal && (
                      <span className="text-neutral-500 dark:text-neutral-400"> · also: {GOAL_LABELS[g.secondary_goal as PrimaryGoal] ?? g.secondary_goal}</span>
                    )}
                    {g.urgency_level && <span className="text-neutral-500 dark:text-neutral-400"> · urgency: {g.urgency_level}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No goal set yet.</p>
            )}
          </Card>
        </section>

        {/* ── Group 2: Activity & Requests, one self-contained unit per real request ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Activity &amp; Requests</h2>

          {/* In-flight re-audit, pre-payment — no reports row exists yet, so no notes/feedback section (nothing real to attach them to). Always expanded — it's inherently active if it exists at all. */}
          {activePendingSubmission && (
            <RequestDetailsUnit
              expanded
              summary={
                <span className="flex flex-wrap items-center gap-2">
                  <TypeBadge type="core_audit" />
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {computeDisplayStatus(activePendingSubmission.stage, activePendingSubmission.paymentStatus)}
                  </span>
                  {activePendingSubmission.stage === "editing" && (
                    <span className="text-neutral-500 dark:text-neutral-400">· edit window closes {new Date(activePendingSubmission.editWindowClosesAt).toLocaleString()}</span>
                  )}
                </span>
              }
            >
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No reviewer-note or feedback section yet — this re-audit hasn&apos;t produced a real report to attach either to.</p>
            </RequestDetailsUnit>
          )}
          {canceledReaudits?.map((c) => (
            <RequestDetailsUnit
              key={c.id}
              expanded={false}
              summary={
                <span className="flex flex-wrap items-center gap-2">
                  <TypeBadge type="core_audit" />
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">Canceled re-audit request</span>
                  <span className="text-neutral-500 dark:text-neutral-400">· submitted {fmt(c.submitted_at as string)}</span>
                </span>
              }
            >
              {c.cancellation_reason && <p className="text-xs italic text-neutral-500 dark:text-neutral-400">Reason: {c.cancellation_reason as string}</p>}
            </RequestDetailsUnit>
          ))}

          {/* Core Audit reports + re-audits — same `reports` table, distinguished by rerun_of_report_id. */}
          {(reports ?? []).map((r) => {
            const isPaidReAudit = r.rerun_of_report_id !== null;
            const kind = isPaidReAudit ? "reaudit" : "report";
            return (
              <RequestDetailsUnit
                key={r.id}
                expanded={!isTerminal(kind === "reaudit" ? "reaudit" : "report", r.status as string)}
                summary={
                  <span className="flex flex-wrap items-center gap-2">
                    <TypeBadge type="core_audit" />
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{isPaidReAudit ? "Re-audit" : "Core Audit"}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {humanizeStatus(r.status as string)} · submitted {fmt(r.submitted_at as string)}
                      {r.delivered_at && <> · delivered {fmt(r.delivered_at as string)}</>}
                    </span>
                    <Link href={`/review/${r.id}`} className="ml-auto text-xs font-medium text-accent hover:underline">
                      Open →
                    </Link>
                  </span>
                }
              >
                <NotesAndFeedback companyId={companyId} entityType="report" entityId={r.id as string} notesByEntity={notesByEntity} feedbackByEntity={feedbackByEntity} />
              </RequestDetailsUnit>
            );
          })}

          {/* Module requests (Tender Readiness / AI Reliability / Data Protection). */}
          {(moduleRequests ?? []).map((m) => {
            const meta = MODULE_META[m.module_type as ModuleType];
            const price = meta ? pricingByKey.get(meta.pricingKey) : undefined;
            return (
              <RequestDetailsUnit
                key={m.id}
                expanded={!isTerminal("module", m.status as string)}
                summary={
                  <span className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={moduleTypeToItemType(m.module_type as string)} />
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{meta?.label ?? m.module_type}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {computeDisplayStatus(m.status as string, m.payment_status as string | null)} · {fmt(m.created_at as string)}
                      {price != null && <> · £{price.toLocaleString()}</>}
                    </span>
                    <Link href={`/review-module/${m.id}`} className="ml-auto text-xs font-medium text-accent hover:underline">
                      Open →
                    </Link>
                  </span>
                }
              >
                {m.cancellation_reason && <p className="text-xs italic text-neutral-500 dark:text-neutral-400">Cancellation reason: {m.cancellation_reason as string}</p>}
                <NotesAndFeedback companyId={companyId} entityType="module_request" entityId={m.id as string} notesByEntity={notesByEntity} feedbackByEntity={feedbackByEntity} />
              </RequestDetailsUnit>
            );
          })}

          {/* Execution Sprints — findings don't apply here (no lens/module findings tied to a sprint), so no feedback section, just status/price/notes. */}
          {(executionSprints ?? []).map((s) => (
            <RequestDetailsUnit
              key={s.id}
              expanded={!isTerminal("sprint", s.status as string)}
              summary={
                <span className="flex flex-wrap items-center gap-2">
                  <TypeBadge type="execution_sprint" />
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">Execution Sprint</span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {computeDisplayStatus(s.status as string, s.payment_status as string | null)}
                    {s.start_date && <> · started {s.start_date}</>}
                    {s.target_end_date && <> · target end {s.target_end_date}</>}
                    {pricingByKey.get("execution_sprint") != null && <> · £{pricingByKey.get("execution_sprint")!.toLocaleString()}</>}
                  </span>
                  <Link href={`/review-sprint/${s.id}`} className="ml-auto text-xs font-medium text-accent hover:underline">
                    Open →
                  </Link>
                </span>
              }
            >
              {s.cancellation_reason && <p className="text-xs italic text-neutral-500 dark:text-neutral-400">Cancellation reason: {s.cancellation_reason as string}</p>}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Reviewer notes for this request</p>
                <ReviewerNotesPanel
                  companyId={companyId}
                  notes={notesByEntity.get(`execution_sprint:${s.id}`) ?? []}
                  relatedEntityType="execution_sprint"
                  relatedEntityId={s.id as string}
                  addLabel="+ Add a note about this request"
                />
              </div>
            </RequestDetailsUnit>
          ))}

          {/* Sessions & Concierge/Training & Advisory requests. Contact Sales keeps its own real ContactSalesStatusRow (status/price/cancel/refund); non-Contact-Sales sessions render their own plain status line (no real price for a genuinely free session type). */}
          {(sessionRequests ?? []).map((s) => {
            const isContactSales = isContactSalesSessionType(s.session_type as string);
            const csRecord = sessionServiceStatus.get(s.id as string);
            const terminal = isContactSales ? isTerminal("session", csRecord?.status ?? "requested") : isTerminal("session", s.status as string);
            const label = sessionTypeToItemType(s.session_type as string);
            return (
              <RequestDetailsUnit
                key={s.id}
                expanded={!terminal}
                summary={
                  <span className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={label} />
                    {isContactSales ? (
                      <span className="text-neutral-500 dark:text-neutral-400">requested {fmt(s.requested_at as string)}</span>
                    ) : (
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {SESSION_STATUS_LABELS[s.status as string] ?? humanizeStatus(s.status as string)} · requested {fmt(s.requested_at as string)}
                        {s.scheduled_at && <> · scheduled {new Date(s.scheduled_at as string).toLocaleString()}</>}
                        {s.completed_at && <> · completed {fmt(s.completed_at as string)}</>}
                      </span>
                    )}
                  </span>
                }
              >
                {s.phone_snapshot && <p className="text-xs text-neutral-500 dark:text-neutral-400">Phone: {s.phone_snapshot as string}</p>}
                {!isContactSales && s.reviewer_notes && (
                  <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
                    {s.status === "declined" ? "Cancellation reason" : "Reviewer notes"}: {s.reviewer_notes as string}
                  </p>
                )}
                {isContactSales && (
                  <ContactSalesStatusRow
                    companyId={companyId}
                    entityId={s.id as string}
                    defaultPrice={SESSION_TYPE_PRICING_KEY[s.session_type as string] ? (pricingByKey.get(SESSION_TYPE_PRICING_KEY[s.session_type as string]) ?? null) : null}
                    record={csRecord}
                  />
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Reviewer notes for this request</p>
                  <ReviewerNotesPanel
                    companyId={companyId}
                    notes={notesByEntity.get(`session_request:${s.id}`) ?? []}
                    relatedEntityType="session_request"
                    relatedEntityId={s.id as string}
                    addLabel="+ Add a note about this request"
                  />
                </div>
              </RequestDetailsUnit>
            );
          })}

          {!activePendingSubmission &&
            (canceledReaudits?.length ?? 0) === 0 &&
            (reports?.length ?? 0) === 0 &&
            (moduleRequests?.length ?? 0) === 0 &&
            (executionSprints?.length ?? 0) === 0 &&
            (sessionRequests?.length ?? 0) === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">No requests yet.</p>}
        </section>

        {/* ── Group 3: General Reviewer Notes — no request association ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">General Reviewer Notes</h2>
          <Card subtitle="Genuinely general observations about this client — not tied to any single request. Notes tied to a specific request appear under that request above.">
            <ReviewerNotesPanel companyId={companyId} notes={generalNotes} />
          </Card>
        </section>
      </div>
    </div>
  );
}
