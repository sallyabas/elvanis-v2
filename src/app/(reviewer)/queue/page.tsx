import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRegulatoryContentReviewStatus } from "@/lib/reviewer/regulatory-content-review";
import { listPendingSessionRequests } from "@/lib/service-layer/session-requests";
import { listPricing } from "@/lib/pricing";
import { listOpenSprintQueueItems } from "@/lib/execution-sprint/workspace";
import { listOpenSprintInterestRequests } from "@/lib/execution-sprint/interest-requests";
import { computeSubmissionDisplayStage, SUBMISSION_STAGE_LABELS } from "@/lib/evidence/submission-status";
import {
  markRegulatoryContentReviewedAction,
  updateSessionRequestStatusAction,
  updatePricingItemAction,
  replyToSprintQueueItemAction,
  resolveSprintInterestRequestAction,
} from "./actions";
import { Card } from "@/app/_components/ui/Card";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";
import { LinkButton } from "@/app/_components/ui/LinkButton";

const SESSION_TYPE_LABELS: Record<string, string> = {
  discovery: "Discovery Session",
  delivery: "Delivery Session",
  f2f_workshop: "F2F Workshop",
};

const JURISDICTION_LABELS: Record<string, string> = {
  eu_ai_act: "EU AI Act",
  uae_difc_reg10: "UAE DIFC Regulation 10",
  saudi_ai_governance: "Saudi AI governance (SDAIA)",
  uk_gdpr: "UK GDPR",
  eu_gdpr: "EU GDPR",
  saudi_pdpl: "Saudi PDPL",
};

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
  readyAt: string | null;
  notified: boolean;
  href: string;
}

export default async function ReviewerQueuePage() {
  const supabase = createAdminClient();

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id, status, edit_window_closes_at, reviewer_notified_at, companies(name)")
    .eq("status", "pending_review")
    .lte("edit_window_closes_at", new Date().toISOString());

  if (reportsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {reportsError.message}</div>;
  }

  // "Still with client" visibility, rewritten 2026-08-10 for the delayed-
  // execution architecture — this used to query `reports` for rows whose
  // edit window hadn't closed yet, but under the new architecture that
  // query is now permanently dead: a `reports` row is only ever created
  // AFTER the window closes (see run-pending-audits.ts), so it could never
  // return anything again. The real "not ready yet" state now lives in
  // pending_evidence_submissions instead — and there's a real, third state
  // to show now beyond "still editing," closing the same visibility gap
  // this section originally existed for, just against the right table:
  // Editing / Queued for audit / Audit in progress (see
  // submission-status.ts). Purely informational — no review action here,
  // same as before.
  const { data: pendingSubmissions, error: pendingSubmissionsError } = await supabase
    .from("pending_evidence_submissions")
    .select("id, status, edit_window_closes_at, submitted_at, companies(name)")
    .neq("status", "completed");

  if (pendingSubmissionsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {pendingSubmissionsError.message}</div>;
  }

  const { data: moduleRequests, error: moduleError } = await supabase
    .from("module_requests")
    .select("id, module_type, status, created_at, reviewer_notified_at, companies(name)")
    .eq("status", "pending_review");

  if (moduleError) {
    return <div className="p-6 text-sm text-red-600">Failed to load reviewer queue: {moduleError.message}</div>;
  }

  const { data: scopedSprints, error: sprintsError } = await supabase
    .from("execution_sprints")
    .select("id, created_at, companies(name)")
    .eq("status", "scoped");

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
      readyAt: r.edit_window_closes_at as string | null,
      notified: Boolean(r.reviewer_notified_at),
      href: `/review/${r.id}`,
    })),
    ...(scopedSprints ?? []).map((s) => ({
      id: s.id as string,
      companyName: (s.companies as unknown as { name: string } | null)?.name ?? "Unknown company",
      label: "Execution Sprint (task review)",
      readyAt: s.created_at as string | null,
      notified: true,
      href: `/review-sprint/${s.id}`,
    })),
    ...moduleRequests.map((r) => ({
      id: r.id as string,
      companyName: (r.companies as unknown as { name: string } | null)?.name ?? "Unknown company",
      label: MODULE_LABELS[r.module_type as string] ?? (r.module_type as string),
      readyAt: (r.created_at as string | null),
      notified: Boolean(r.reviewer_notified_at),
      href: `/review-module/${r.id}`,
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

  const regulatoryStatus = await listRegulatoryContentReviewStatus();
  const sessionRequests = await listPendingSessionRequests();
  const pricing = await listPricing();
  const sprintQueueItems = await listOpenSprintQueueItems();
  const sprintInterestRequests = await listOpenSprintInterestRequests();

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
            <ul className="space-y-2">
              {sessionRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                  <div>
                    <span className="font-medium">{r.companyName}</span>{" "}
                    <span className="text-neutral-500 dark:text-neutral-400">
                      · {SESSION_TYPE_LABELS[r.session_type] ?? r.session_type} · {r.status} · requested{" "}
                      {new Date(r.requested_at).toLocaleDateString()}
                    </span>
                    {r.client_notes && <p className="text-xs text-neutral-400 dark:text-neutral-500">&quot;{r.client_notes}&quot;</p>}
                  </div>
                  <div className="flex gap-1">
                    {r.status === "requested" && (
                      <form action={updateSessionRequestStatusAction.bind(null, r.id, "scheduled")}>
                        <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                          Mark scheduled
                        </Button>
                      </form>
                    )}
                    <form action={updateSessionRequestStatusAction.bind(null, r.id, "completed")}>
                      <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                        Mark completed
                      </Button>
                    </form>
                    <form action={updateSessionRequestStatusAction.bind(null, r.id, "declined")}>
                      <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                        Decline
                      </Button>
                    </form>
                  </div>
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
                <li key={item.id} className="rounded-md border border-neutral-300 bg-white p-3 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="mb-1 flex items-center justify-between text-neutral-900 dark:text-neutral-50">
                    <span className="font-medium">{item.companyName}</span>
                    <Link href={`/review-sprint/${item.sprintId}`} className="text-xs underline">
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
                    · last reviewed {new Date(r.lastReviewedAt).toLocaleDateString()} ({r.daysSinceReview}d ago
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

      <h2 className="mb-3 mt-8 text-lg font-medium text-neutral-900 dark:text-neutral-50">Ready for review</h2>
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
            <div key={companyName} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="mb-3 font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h3>
              <ul className="space-y-2">
                {companyItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-md border border-neutral-100 p-3 dark:border-neutral-800">
                    <div>
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.label}</div>
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

      {/* "Still with client" visibility, rewritten 2026-08-10 for the
          delayed-execution architecture — see the query docblock above.
          Purely informational, no review action here: a submission still
          'editing' or 'queued_for_audit' has nothing for a reviewer to do
          yet; 'audit_in_progress' means the scheduled run just started, no
          action needed there either — this section exists so a reviewer
          can always see exactly where a submission stands, closing the
          same original queue-invisibility gap this section was first
          built for, just against the table that's actually current now. */}
      {pendingByCompany.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-medium text-neutral-900 dark:text-neutral-50">Still with client</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Evidence submitted, not ready for review yet — nothing to do here yet.
          </p>
          <ul className="space-y-2">
            {pendingByCompany.map((p) => (
              <li
                key={p.companyName}
                className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
              >
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{p.companyName}</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  · {p.stage ? SUBMISSION_STAGE_LABELS[p.stage] : "Unknown"} · submitted{" "}
                  {new Date(p.submittedAt).toLocaleString()}
                  {p.stage === "editing" && <> · edit window closes {new Date(p.editWindowClosesAt).toLocaleString()}</>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
