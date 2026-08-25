import { loadUnifiedRequests } from "@/lib/reviewer/unified-requests";
import { RequestsFilterClient } from "./RequestsFilterClient";

/**
 * Unified, filterable request list (confirmed 2026-08-25, direct founder
 * request) — one place to see every request of every type (Core Audit,
 * module, session/Concierge, Execution Sprint), replacing the need to
 * check /queue's separate sections individually. Deliberately NOT a
 * replacement for /queue — /queue's own sections carry real per-type
 * actions (Accept/Edit/Reject, Schedule/Complete/Decline); this page is
 * a browsing/filtering view with "Open" links into those same workspaces,
 * not a second place those actions live.
 *
 * A global reports list and a metrics dashboard (total users, overdue
 * counts, volume trends, AI-generated insights) were explicitly held,
 * per direct instruction — genuinely valuable once real client volume
 * exists, not before.
 */
export default async function UnifiedRequestsPage() {
  const rows = await loadUnifiedRequests();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">All requests</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Every Core Audit, module, session/Concierge, and Execution Sprint request in one filterable list.
      </p>
      <RequestsFilterClient rows={rows} />
    </div>
  );
}
