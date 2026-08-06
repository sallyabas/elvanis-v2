import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRegulatoryContentReviewStatus } from "@/lib/reviewer/regulatory-content-review";
import { listPendingSessionRequests } from "@/lib/service-layer/session-requests";
import { listPricing } from "@/lib/pricing";
import { listOpenSprintQueueItems } from "@/lib/execution-sprint/workspace";
import { listOpenSprintInterestRequests } from "@/lib/execution-sprint/interest-requests";
import {
  markRegulatoryContentReviewedAction,
  updateSessionRequestStatusAction,
  updatePricingItemAction,
  replyToSprintQueueItemAction,
  resolveSprintInterestRequestAction,
} from "./actions";

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

  const regulatoryStatus = await listRegulatoryContentReviewStatus();
  const sessionRequests = await listPendingSessionRequests();
  const pricing = await listPricing();
  const sprintQueueItems = await listOpenSprintQueueItems();
  const sprintInterestRequests = await listOpenSprintInterestRequests();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Reviewer Queue</h1>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-medium">Session requests</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Discovery/Delivery/F2F Workshop requests — no calendar integration exists yet, so these are followed up
          personally, then marked here.
        </p>
        {sessionRequests.length === 0 ? (
          <p className="text-sm text-neutral-500">No pending session requests.</p>
        ) : (
          <ul className="space-y-2">
            {sessionRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{r.companyName}</span>{" "}
                  <span className="text-neutral-500">
                    · {SESSION_TYPE_LABELS[r.session_type] ?? r.session_type} · {r.status} · requested{" "}
                    {new Date(r.requested_at).toLocaleDateString()}
                  </span>
                  {r.client_notes && <p className="text-xs text-neutral-400">&quot;{r.client_notes}&quot;</p>}
                </div>
                <div className="flex gap-1">
                  {r.status === "requested" && (
                    <form action={updateSessionRequestStatusAction.bind(null, r.id, "scheduled")}>
                      <button type="submit" className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                        Mark scheduled
                      </button>
                    </form>
                  )}
                  <form action={updateSessionRequestStatusAction.bind(null, r.id, "completed")}>
                    <button type="submit" className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                      Mark completed
                    </button>
                  </form>
                  <form action={updateSessionRequestStatusAction.bind(null, r.id, "declined")}>
                    <button type="submit" className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                      Decline
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-medium">Pricing</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          DB-backed, not hardcoded anywhere in the app (confirmed 2026-08-06) — same admin-adjustable principle as
          the re-audit cadence. No separate admin role exists yet, so this is reviewer-facing for now.
        </p>
        <ul className="space-y-2">
          {pricing.map((p) => (
            <li key={p.itemKey} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{p.displayName}</span>{" "}
                {p.isPlaceholder && <span className="text-xs text-amber-600 dark:text-amber-400">(placeholder)</span>}
                {p.notes && <p className="text-xs text-neutral-400">{p.notes}</p>}
              </div>
              <form action={updatePricingItemAction} className="flex items-center gap-1">
                <input type="hidden" name="itemKey" value={p.itemKey} />
                <span className="text-xs text-neutral-500">{p.currency}</span>
                <input
                  type="number"
                  name="priceAmount"
                  defaultValue={p.priceAmount}
                  min={0}
                  step="1"
                  className="w-20 rounded border border-neutral-300 px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="submit"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Update
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-medium">Execution Sprint queue</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Client change-request notes and deterministic KPI-deviation alerts on active sprints. Replies send an email
          immediately, not on the next cron tick.
        </p>
        {sprintQueueItems.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing open.</p>
        ) : (
          <ul className="space-y-3">
            {sprintQueueItems.map((item) => (
              <li key={item.id} className="rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{item.companyName}</span>
                  <Link href={`/review-sprint/${item.sprintId}`} className="text-xs underline">
                    View sprint
                  </Link>
                </div>
                <p className="text-xs text-neutral-500">
                  {item.trigger_type === "kpi_deviation" ? "KPI deviation" : "Change request"} · {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">{item.note}</p>
                <form action={replyToSprintQueueItemAction} className="mt-2 flex gap-2">
                  <input type="hidden" name="queueItemId" value={item.id} />
                  <input
                    type="text"
                    name="replyText"
                    placeholder="Reply to the client…"
                    required
                    className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <button
                    type="submit"
                    className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Send
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-medium">Execution Sprint interest</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          A client marked interest in help implementing a specific finding (confirmed 2026-08-06, honest UX review
          pass) — the client-facing entry point Execution Sprint previously had none of. Doesn&apos;t create the
          sprint itself; open the report and use &quot;Start an Execution Sprint&quot; there.
        </p>
        {sprintInterestRequests.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing open.</p>
        ) : (
          <ul className="space-y-2">
            {sprintInterestRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{r.companyName}</span>{" "}
                  <span className="text-neutral-500">
                    · {r.findingTitle} · {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Link
                    href={`/review/${r.report_id}`}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Open report
                  </Link>
                  <form action={resolveSprintInterestRequestAction.bind(null, r.id)}>
                    <button type="submit" className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                      Dismiss
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-medium">Regulatory content status</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          When each jurisdiction&apos;s regulatory reference content was last manually checked against current law —
          this is a manual process, nothing in the code can detect a law changing on its own.
        </p>
        <ul className="space-y-2">
          {regulatoryStatus.map((r) => (
            <li key={r.jurisdiction} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{JURISDICTION_LABELS[r.jurisdiction] ?? r.jurisdiction}</span>{" "}
                <span className={r.isOverdue ? "text-red-600 dark:text-red-400" : "text-neutral-500"}>
                  · last reviewed {new Date(r.lastReviewedAt).toLocaleDateString()} ({r.daysSinceReview}d ago
                  {r.isOverdue ? " · overdue" : ""})
                </span>
              </div>
              <form action={markRegulatoryContentReviewedAction.bind(null, r.jurisdiction)}>
                <button
                  type="submit"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Mark reviewed
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Everything ready for review — Core Audit reports and standalone module requests together, oldest first.
        Still-editable Core Audit reports don&apos;t appear here yet.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing waiting on review right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <div className="font-medium">
                  {item.companyName} <span className="font-normal text-neutral-500">· {item.label}</span>
                </div>
                <div className="text-xs text-neutral-500">
                  Ready {item.readyAt ? new Date(item.readyAt).toLocaleString() : "unknown"}
                  {item.notified ? " · reviewer notified" : " · not yet notified"}
                </div>
              </div>
              <Link
                href={item.href}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
