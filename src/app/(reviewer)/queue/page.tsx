import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRegulatoryContentReviewStatus } from "@/lib/reviewer/regulatory-content-review";
import { JURISDICTION_LABELS } from "@/lib/reviewer/regulatory-staleness";
import { listPendingSessionRequests } from "@/lib/service-layer/session-requests";
import { listPricing } from "@/lib/pricing";
import { listOpenSprintQueueItems, listAllSprints } from "@/lib/execution-sprint/workspace";
import { listOpenSprintInterestRequests } from "@/lib/execution-sprint/interest-requests";
import { listDeliveryFeedback } from "@/lib/reviewer/delivery-feedback";
import { computeSubmissionDisplayStage, SUBMISSION_STAGE_LABELS } from "@/lib/evidence/submission-status";
import { getSettingNumber } from "@/lib/app-settings";
import { type ItemType, TypeBadge, moduleTypeToItemType, sessionTypeToItemType } from "@/lib/item-type-badge";
import { SESSION_STATUS_LABELS } from "@/lib/format";
import {
  markRegulatoryContentReviewedAction,
  scheduleSessionRequestAction,
  completeSessionRequestAction,
  declineSessionRequestAction,
  updatePricingItemAction,
  replyToSprintQueueItemAction,
  resolveSprintInterestRequestAction,
} from "./actions";
import { Card } from "@/app/_components/ui/Card";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";
import { LinkButton } from "@/app/_components/ui/LinkButton";

// Reviewer Queue — everything actually ready for review, oldest first. One
// unified queue across the core audit AND every standalone module
// (confirmed 2026-08-02: "not three different review interfaces") — a
// reviewer sees Core Audit reports and AI Reliability/Tender Readiness/
// Data Protection requests in the same list, not separate queues per type.
//
// "Ready" means the 24h edit window has closed for reports
// (edit_window_closes_at <= now); still-editable reports are the client's
// business, not the reviewer's yet — see spec §2.3a. Modules have no
// client-facing edit-window flow yet, so they're ready as soon as created.
interface QueueItem {
  id: string;
  companyName: string;
  label: string;
  /**
   * Colored badge identity (confirmed 2026-08-26, navigation-audit fix
   * batch, item 3) — `label` stays around for the sprint case's own extra
   * "(task review)" qualifier text, which the shared badge system has no
   * concept of.
   */
  badgeType: ItemType;
  readyAt: string | null;
  notified: boolean;
  href: string;
  /**
   * Real 48h review-SLA enforcement (confirmed 2026-08-12, direct founder
   * request — this used to be narrative only, see sla.ts's own docblock).
   * Only ever true for Core Audit reports right now — reports.review_due_at
   * is the only place this deadline is actually stamped; modules and
   * sprints don't have an equivalent yet, so they're always `false` here
   * rather than silently guessed at.
   */
  overdue: boolean;
  /**
   * Urgency flag (confirmed 2026-08-27, Onboarding Architecture & Path
   * Routing brief, Part 3/8f) — stamped at creation from the company's own
   * triage_compliance_request answer at that moment. Currently only ever
   * true for Tender Readiness module requests (see path-b-routing.ts);
   * every other item type is always `false` here, same "never silently
   * guessed at" discipline as `overdue` above.
   */
  urgent: boolean;
}

export default async function ReviewerQueuePage() {
  const supabase = createAdminClient();

  // Real perf fix (confirmed 2026-09-05, code-quality audit) — this page
  // does 13 independent DB/settings reads across its 8+ panels; none of
  // them reads another one's result, but every one was previously
  // awaited one at a time in series, paying a full network round-trip
  // each. Batched into one Promise.all — every actual query/filter and
  // the resulting variable names are byte-identical to before, only the
  // network scheduling changed. Error handling is preserved exactly:
  // each of the four queries that used to bail out with its own early
  // return still does, checked in the same order right after the batch
  // resolves (Supabase queries return {data,error} rather than throwing,
  // so batching into Promise.all doesn't lose this).
  const [
    { data: reports, error: reportsError },
    { data: pendingSubmissions, error: pendingSubmissionsError },
    { data: moduleRequests, error: moduleError },
    moduleTurnaroundHours,
    { data: awaitingDeliveryModules, error: awaitingDeliveryError },
    { data: scopedSprints, error: sprintsError },
    regulatoryStatus,
    sessionRequests,
    pricing,
    deliveryFeedback,
    sprintQueueItems,
    sprintInterestRequests,
    allSprints,
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("id, status, edit_window_closes_at, review_due_at, reviewer_notified_at, companies(name)")
      .eq("status", "pending_review")
      .lte("edit_window_closes_at", new Date().toISOString()),
    // "Still with client" visibility, rewritten 2026-08-10 for the
    // delayed-execution architecture — this used to query `reports` for
    // rows whose edit window hadn't closed yet, but under the new
    // architecture that query is now permanently dead: a `reports` row
    // is only ever created AFTER the window closes (see
    // run-pending-audits.ts), so it could never return anything again.
    // The real "not ready yet" state now lives in
    // pending_evidence_submissions instead — and there's a real, third
    // state to show now beyond "still editing," closing the same
    // visibility gap this section originally existed for, just against
    // the right table: Editing / Queued for audit / Audit in progress
    // (see submission-status.ts). Purely informational — no review
    // action here, same as before.
    supabase
      .from("pending_evidence_submissions")
      .select("id, status, edit_window_closes_at, submitted_at, companies(name)")
      .neq("status", "completed"),
    supabase
      .from("module_requests")
      .select("id, module_type, status, created_at, reviewer_notified_at, is_urgent, companies(name)")
      .eq("status", "pending_review"),
    // Real gap closed (confirmed 2026-08-19, direct founder request) —
    // once a reviewer approves a module request, it dropped out of this
    // queue entirely with no reminder that delivery is still owed.
    // `created_at` IS the real submission moment here — modules have no
    // separate client-edit-window step.
    //
    // SLA source of truth, corrected 2026-09-03 (direct founder request,
    // following the Groq-failure investigation) — this used to read
    // getTotalTurnaroundHours() (edit_window_hours + review_period_hours,
    // 72h by default), a CORE-AUDIT-specific concept that doesn't
    // actually apply to modules (they have no client edit window at
    // all). Meanwhile module_delivery_turnaround_target_hours (48h)
    // already existed, purpose-built for exactly this, and was already
    // the number the landing page and the module review workspace's own
    // "time in review" display used — a real, live inconsistency
    // between what "on time" meant depending on which page you looked
    // at. Standardized on the purpose-built setting everywhere modules
    // are concerned; see dashboard/page.tsx's isModuleOverdue() for the
    // matching fix on the client-facing side.
    getSettingNumber("module_delivery_turnaround_target_hours", 48),
    supabase
      .from("module_requests")
      .select("id, module_type, created_at, approved_at, companies(name)")
      .eq("status", "approved"),
    supabase.from("execution_sprints").select("id, created_at, companies(name)").eq("status", "scoped"),
    listRegulatoryContentReviewStatus(),
    listPendingSessionRequests(),
    listPricing(),
    listDeliveryFeedback(),
    listOpenSprintQueueItems(),
    listOpenSprintInterestRequests(),
    listAllSprints(),
  ]);

  if (reportsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {reportsError.message}</div>;
  }
  if (pendingSubmissionsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {pendingSubmissionsError.message}</div>;
  }
  if (moduleError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {moduleError.message}</div>;
  }
  if (awaitingDeliveryError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {awaitingDeliveryError.message}</div>;
  }
  if (sprintsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {sprintsError.message}</div>;
  }

  const MODULE_LABELS: Record<string, string> = {
    ai_reliability: "AI Reliability Audit",
    tender_readiness: "Tender Readiness",
    data_protection: "Data Protection Compliance",
  };

  const items: QueueItem[] = [
    ...reports.map((r) => ({
      id: r.id as string,
      companyName: (r.companies as unknown as { name: string } | null)?.name ?? "Unknown company",
      label: "Core Audit",
      badgeType: "core_audit" as const,
      readyAt: r.edit_window_closes_at as string | null,
      notified: Boolean(r.reviewer_notified_at),
      href: `/review/${r.id}`,
      overdue: r.review_due_at ? new Date(r.review_due_at as string) < new Date() : false,
      urgent: false,
    })),
    ...(scopedSprints ?? []).map((s) => ({
      id: s.id as string,
      companyName: (s.companies as unknown as { name: string } | null)?.name ?? "Unknown company",
      label: "Execution Sprint (task review)",
      badgeType: "execution_sprint" as const,
      readyAt: s.created_at as string | null,
      notified: true,
      href: `/review-sprint/${s.id}`,
      overdue: false,
      urgent: false,
    })),
    ...moduleRequests.map((r) => ({
      id: r.id as string,
      companyName: (r.companies as unknown as { name: string } | null)?.name ?? "Unknown company",
      label: MODULE_LABELS[r.module_type as string] ?? (r.module_type as string),
      badgeType: moduleTypeToItemType(r.module_type as string),
      readyAt: (r.created_at as string | null),
      notified: Boolean(r.reviewer_notified_at),
      href: `/review-module/${r.id}`,
      // Real gap closed (confirmed 2026-09-03, direct founder request) —
      // this was hardcoded false, meaning a module sitting in
      // pending_review (not yet reviewed at all) had zero overdue
      // visibility anywhere; only "awaiting delivery" (already approved)
      // ever got a badge. Same deadline math as that section, applied to
      // the pre-review stage instead — created_at is the real submission
      // moment for a module either way.
      overdue: new Date(new Date(r.created_at as string).getTime() + moduleTurnaroundHours * 60 * 60 * 1000) < new Date(),
      urgent: Boolean(r.is_urgent),
    })),
  ].sort((a, b) => new Date(a.readyAt ?? 0).getTime() - new Date(b.readyAt ?? 0).getTime());

  // Grouped-by-company restructure (confirmed 2026-08-10, real bug list
  // from live testing) — the ready-for-review list was previously one
  // flat, undifferentiated list; a reviewer with several items for the
  // same company (e.g. a Core Audit report and a module request both
  // pending at once) had no visual way to associate them together short
  // of reading every company name individually. Grouped here, sorted by
  // each group's earliest-ready item — still linking out to each item's
  // own real review workspace (/review, /review-module, /review-sprint)
  // for full details/actions, rather than duplicating those workspaces
  // into a new page.
  const itemsByCompany = new Map<string, QueueItem[]>();
  for (const item of items) {
    itemsByCompany.set(item.companyName, [...(itemsByCompany.get(item.companyName) ?? []), item]);
  }
  const groupedItems = [...itemsByCompany.entries()].sort(
    ([, a], [, b]) => new Date(a[0].readyAt ?? 0).getTime() - new Date(b[0].readyAt ?? 0).getTime(),
  );

  // At most one active pending_evidence_submissions row per company (see
  // the migration's own partial unique index), so this is a simple
  // company → single-row map, not a list-per-company like the old
  // reports-based version needed.
  const pendingByCompany = (pendingSubmissions ?? []).map((r) => {
    const name = (r.companies as unknown as { name: string } | null)?.name ?? "Unknown company";
    const stage = computeSubmissionDisplayStage({
      status: r.status as "editing" | "audit_in_progress" | "completed",
      edit_window_closes_at: r.edit_window_closes_at as string,
    });
    return { companyName: name, stage, submittedAt: r.submitted_at as string, editWindowClosesAt: r.edit_window_closes_at as string };
  });

  // Split "Still with client" into two genuinely different states
  // (confirmed 2026-08-12, direct founder request) — the original single
  // section conflated two things that read very differently to a
  // reviewer: a submission genuinely still being edited by the client
  // (real "still with client," nothing to watch) vs. one whose edit
  // window has already closed and is just waiting on the next scheduled
  // cron run to actually generate the report — that one isn't with the
  // client at all anymore, it's queued on OUR side. Same underlying data
  // (pendingByCompany/computeSubmissionDisplayStage), just partitioned
  // for display rather than lumped into one label.
  const stillEditing = pendingByCompany.filter((p) => p.stage === "editing");
  const queuedOrProcessing = pendingByCompany.filter((p) => p.stage === "queued_for_audit" || p.stage === "audit_in_progress");

  // regulatoryStatus/sessionRequests/pricing/deliveryFeedback/
  // sprintQueueItems/sprintInterestRequests/allSprints are all already
  // available from the batch above.

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Reviewer Queue</h1>

      <div className="space-y-6">
        <Card title="Session requests">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Discovery/Delivery/F2F Workshop requests — no calendar integration exists yet, so these are followed up
            personally, then marked here.
          </p>
          {sessionRequests.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No pending session requests.</p>
          ) : (
            <ul className="space-y-4">
              {sessionRequests.map((r) => (
                <li key={r.id} className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Link href={`/company/${r.company_id}`} className="font-medium text-accent hover:underline">
                      {r.companyName}
                    </Link>
                    <TypeBadge type={sessionTypeToItemType(r.session_type)} />
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {SESSION_STATUS_LABELS[r.status] ?? r.status} · requested {new Date(r.requested_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.client_notes && <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">&quot;{r.client_notes}&quot;</p>}
                  {/* Phone snapshot (confirmed 2026-09-03) — the number on
                      file AT REQUEST TIME, not a live profile reference. */}
                  {r.phone_snapshot && <p className="mb-2 text-xs text-neutral-700 dark:text-neutral-300">Phone: {r.phone_snapshot}</p>}
                  {r.status === "scheduled" && r.scheduled_at && (
                    <p className="mb-2 text-xs text-neutral-700 dark:text-neutral-300">
                      Scheduled for <span className="font-medium">{new Date(r.scheduled_at).toLocaleString()}</span>
                      {r.reviewer_notes && <> · {r.reviewer_notes}</>}
                    </p>
                  )}

                  {/*
                   * Real workflow, not three inert buttons (confirmed
                   * 2026-08-11, live testing pass — this exact panel was
                   * reported "done" before and turned out to still be a
                   * shallow stub). "Schedule" now takes a real date/time
                   * and optional notes; "Decline" requires a real reason
                   * and now notifies the client; "Complete" records a real
                   * outcome. All three stay visible together (matching
                   * this page's existing dense reviewer-form convention)
                   * rather than hidden behind extra clicks.
                   */}
                  <div className="flex flex-wrap gap-3">
                    {r.status === "requested" && (
                      <form action={scheduleSessionRequestAction} className="flex items-end gap-1.5">
                        <input type="hidden" name="requestId" value={r.id} />
                        {/* Real, confirmed accessibility bug found live via
                            the Playwright session-lifecycle spec
                            (2026-09-03) — id defaults to `name` when no
                            explicit id is passed (see Input.tsx), and
                            since every pending session request on this
                            page renders its own copy of this exact form
                            with the same literal name="scheduledAt", every
                            instance got the SAME id, a genuine HTML id
                            collision. Only the first one on the page ever
                            got a real label association — every other
                            request's "Schedule for" field was
                            programmatically unnamed (confirmed via the
                            accessibility tree: a bare, unnamed textbox),
                            same real-user impact as the original id/name
                            gap this component's own useId() fix already
                            closed once, just triggered by a different
                            cause. Fixed with a real per-request unique id
                            — name stays "scheduledAt" unchanged, since the
                            Server Action reads the field by name, not id. */}
                        <Input type="datetime-local" name="scheduledAt" id={`scheduledAt-${r.id}`} label="Schedule for" required className="py-1 text-xs" />
                        <Input type="text" name="notes" placeholder="Notes (optional)" className="py-1 text-xs" />
                        <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                          Schedule
                        </Button>
                      </form>
                    )}
                    {(r.status === "requested" || r.status === "scheduled") && (
                      <form action={completeSessionRequestAction} className="flex items-end gap-1.5">
                        <input type="hidden" name="requestId" value={r.id} />
                        <Input type="text" name="notes" placeholder="Outcome notes" className="py-1 text-xs" />
                        <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                          Mark completed
                        </Button>
                      </form>
                    )}
                    {(r.status === "requested" || r.status === "scheduled") && (
                      <form action={declineSessionRequestAction} className="flex items-end gap-1.5">
                        <input type="hidden" name="requestId" value={r.id} />
                        <Input type="text" name="reason" placeholder="Reason (required)" required className="py-1 text-xs" />
                        <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                          Decline
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Automated post-delivery feedback + pilot testimonial/referral
            responses (confirmed 2026-08-24) — real place to review what
            clients actually said, on top of (not instead of) reaching out
            personally. */}
        <Card title="Client feedback">
          {deliveryFeedback.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No responses yet.</p>
          ) : (
            <ul className="space-y-3">
              {deliveryFeedback.map((f) => (
                <li key={f.id} className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-neutral-900 dark:text-neutral-50">{f.companyName}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {f.feedbackType === "testimonial" ? "Testimonial/referral" : "Feedback"} · {new Date(f.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {f.responseText && <p className="text-neutral-700 dark:text-neutral-300">{f.responseText}</p>}
                  {f.referralContact && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Referral: {f.referralContact}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Pricing">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            DB-backed, not hardcoded anywhere in the app (confirmed 2026-08-06) — same admin-adjustable principle as
            the re-audit cadence. No separate admin role exists yet, so this is reviewer-facing for now.
          </p>
          <ul className="space-y-2">
            {pricing.map((p) => (
              <li key={p.itemKey} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                <div>
                  <span className="font-medium">{p.displayName}</span>{" "}
                  {p.isPlaceholder && <span className="text-xs text-amber-600 dark:text-amber-400">(placeholder)</span>}
                  {p.notes && <p className="text-xs text-neutral-400 dark:text-neutral-500">{p.notes}</p>}
                </div>
                <form action={updatePricingItemAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="itemKey" value={p.itemKey} />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{p.currency}</span>
                  <Input type="number" name="priceAmount" defaultValue={p.priceAmount} min={0} step="1" className="w-20 py-1 text-xs" />
                  <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                    Update
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Execution Sprint queue">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Client change-request notes and deterministic KPI-deviation alerts on active sprints. Replies send an email
            immediately, not on the next cron tick.
          </p>
          {sprintQueueItems.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing open.</p>
          ) : (
            <ul className="space-y-3">
              {sprintQueueItems.map((item) => (
                <li key={item.id} className="rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-card-1 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="mb-1 flex items-center justify-between text-neutral-900 dark:text-neutral-50">
                    <span className="font-medium">{item.companyName}</span>
                    <Link href={`/review-sprint/${item.sprintId}`} className="text-xs font-medium text-accent hover:underline">
                      View sprint
                    </Link>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {item.trigger_type === "kpi_deviation" ? "KPI deviation" : "Change request"} · {new Date(item.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 text-neutral-700 dark:text-neutral-300">{item.note}</p>
                  <form action={replyToSprintQueueItemAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="queueItemId" value={item.id} />
                    <Input type="text" name="replyText" placeholder="Reply to the client…" required className="flex-1 py-1 text-xs" />
                    <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                      Send
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Execution Sprint interest">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            A client marked interest in help implementing a specific finding (confirmed 2026-08-06, honest UX review
            pass) — the client-facing entry point Execution Sprint previously had none of. Doesn&apos;t create the
            sprint itself; open the report and use &quot;Start an Execution Sprint&quot; there.
          </p>
          {sprintInterestRequests.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing open.</p>
          ) : (
            <ul className="space-y-2">
              {sprintInterestRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                  <div>
                    <span className="font-medium">{r.companyName}</span>{" "}
                    <span className="text-neutral-500 dark:text-neutral-400">
                      · {r.findingTitle} · {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <LinkButton href={`/review/${r.report_id}`} variant="secondary" className="px-2 py-1 text-xs">
                      Open report
                    </LinkButton>
                    <form action={resolveSprintInterestRequestAction.bind(null, r.id)}>
                      <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                        Dismiss
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/*
         * Real gap found and fixed (confirmed 2026-08-11, live testing
         * pass) — the queue previously only ever surfaced a sprint when it
         * needed a reviewer decision (still 'scoped') or had an open
         * change-request/KPI-deviation note; a healthy in-progress sprint
         * or an already-complete one was invisible here entirely. Same
         * "full directory, not just an action queue" pattern already used
         * correctly for "Ready for review" above.
         */}
        <Card title="All Execution Sprints">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Every sprint regardless of status — the sections above only ever show sprints that need a decision or
            have an open note; this is the full list.
          </p>
          {allSprints.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No sprints yet.</p>
          ) : (
            <ul className="space-y-2">
              {allSprints.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                  <div>
                    <span className="font-medium">{s.companyName}</span>{" "}
                    <span className="text-neutral-500 dark:text-neutral-400">
                      · {s.findingTitle ?? "Untitled finding"} · {s.status}
                      {s.targetEndDate && <> · target end {new Date(s.targetEndDate).toLocaleDateString()}</>}
                    </span>
                  </div>
                  <LinkButton href={`/review-sprint/${s.id}`} variant="secondary" className="px-2 py-1 text-xs">
                    Open
                  </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Regulatory content status">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            When each jurisdiction&apos;s regulatory reference content was last manually checked against current law —
            this is a manual process, nothing in the code can detect a law changing on its own.
          </p>
          <ul className="space-y-2">
            {regulatoryStatus.map((r) => (
              <li key={r.jurisdiction} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                <div>
                  <span className="font-medium">{JURISDICTION_LABELS[r.jurisdiction] ?? r.jurisdiction}</span>{" "}
                  <span className={r.isOverdue ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}>
                    · last reviewed {new Date(r.lastReviewedAt).toLocaleDateString()} ({r.daysSinceReview}d ago, {r.cadenceDays}d cadence
                    {r.isOverdue ? " · overdue" : ""})
                  </span>
                </div>
                <form action={markRegulatoryContentReviewedAction.bind(null, r.jurisdiction)}>
                  <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                    Mark reviewed
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-neutral-900 dark:text-neutral-50">Ready for review</h2>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        Grouped by company (confirmed 2026-08-10, real bug list from live testing) — each item still links to its own
        full workspace (findings, actions, everything), grouping just makes it obvious at a glance when the same
        company has more than one thing waiting.
      </p>

      {groupedItems.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing waiting on review right now.</p>
      ) : (
        <div className="space-y-5">
          {groupedItems.map(([companyName, companyItems]) => (
            <div key={companyName} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card-1 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="mb-3 font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h3>
              <ul className="space-y-2">
                {companyItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-md border border-neutral-100 p-3 dark:border-neutral-800">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        <TypeBadge type={item.badgeType} />
                        {item.badgeType === "execution_sprint" && <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">(task review)</span>}
                        {item.overdue && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950 dark:text-red-300">
                            Overdue
                          </span>
                        )}
                        {item.urgent && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950 dark:text-red-300">
                            Urgent
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Ready {item.readyAt ? new Date(item.readyAt).toLocaleString() : "unknown"}
                        {item.notified ? " · reviewer notified" : " · not yet notified"}
                      </div>
                    </div>
                    <LinkButton href={item.href} className="px-3 py-1.5 text-sm">
                      Review
                    </LinkButton>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Real gap closed (confirmed 2026-08-19, direct founder request) —
          once a reviewer approves a module request, it previously dropped
          out of this queue entirely (this page only ever queried
          status = 'pending_review') with nothing to remind the reviewer
          delivery is still owed. Same visual "Overdue" badge pattern as
          "Ready for review" above, reusing the same DB-backed total-
          turnaround-hours target against created_at (modules have no
          separate client-edit-window step, so created_at is the real
          submission moment here). */}
      {(awaitingDeliveryModules ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">Awaiting delivery</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Reviewed and approved, not yet delivered to the client.
          </p>
          <ul className="space-y-2">
            {(awaitingDeliveryModules ?? []).map((r) => {
              const deliveryDeadline = new Date(new Date(r.created_at as string).getTime() + moduleTurnaroundHours * 60 * 60 * 1000);
              const overdue = deliveryDeadline < new Date();
              const companyName = (r.companies as unknown as { name: string } | null)?.name ?? "Unknown company";
              return (
                <li key={r.id as string} className="flex items-center justify-between rounded-md border border-neutral-200 bg-white p-3 shadow-card-1 dark:border-neutral-800 dark:bg-neutral-900">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {companyName} — <TypeBadge type={moduleTypeToItemType(r.module_type as string)} />
                      {overdue && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950 dark:text-red-300">
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Approved {r.approved_at ? new Date(r.approved_at as string).toLocaleString() : "unknown"}
                    </div>
                  </div>
                  <LinkButton href={`/review-module/${r.id}`} className="px-3 py-1.5 text-sm">
                    Open
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* "Still with client" visibility, rewritten 2026-08-10 for the
          delayed-execution architecture — see the query docblock above.
          Purely informational, no review action here. Split into two
          distinct sections 2026-08-12 (see the pendingByCompany docblock
          above) — a real submission genuinely still being edited reads
          very differently from one that's already closed and just
          waiting on the next scheduled run, and lumping them under one
          "still with client" label was misleading for the second case. */}
      {stillEditing.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">Still with client</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            The client is still editing — their edit window hasn&apos;t closed yet. Nothing to do here yet.
          </p>
          <ul className="space-y-2">
            {stillEditing.map((p) => (
              <li
                key={p.companyName}
                className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
              >
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{p.companyName}</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  · submitted {new Date(p.submittedAt).toLocaleString()} · edit window closes{" "}
                  {new Date(p.editWindowClosesAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {queuedOrProcessing.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">Queued, not yet processed</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            The client&apos;s edit window has closed — waiting on the next scheduled run to generate the report. Not with
            the client anymore, but no action needed from you yet either.
          </p>
          <ul className="space-y-2">
            {queuedOrProcessing.map((p) => (
              <li
                key={p.companyName}
                className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/40"
              >
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{p.companyName}</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  · {p.stage ? SUBMISSION_STAGE_LABELS[p.stage] : "Unknown"} · submitted{" "}
                  {new Date(p.submittedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
