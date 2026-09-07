import { Alert } from "@/app/_components/ui/Alert";
import { type TimingInfo, formatDuration } from "./types";

/**
 * ReviewWorkspaceClient.tsx decomposition (confirmed 2026-09-07) — company
 * name/plan-tier badge+select/report-status line, the page-wide action
 * error (any handler's uncaught-RPC-failure state, not scoped to one
 * section), and the reviewer-time/full-cycle duration summary. All four
 * sit together at the very top of the original JSX, none has enough
 * independent complexity to warrant its own file.
 */
export function WorkspaceHeader({
  companyName,
  planTier,
  companyUserId,
  tierPending,
  onSetPlanTier,
  reportStatus,
  actionError,
  timing,
}: {
  companyName: string;
  planTier: string;
  companyUserId: string | null;
  tierPending: boolean;
  onSetPlanTier: (tier: "free" | "concierge") => void;
  reportStatus: string;
  actionError: string | null;
  timing: TimingInfo;
}) {
  const fullCycle = formatDuration(timing.submittedAt, timing.approvedAt);
  const reviewerOnly = formatDuration(timing.editWindowClosesAt, timing.approvedAt);

  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            planTier === "concierge"
              ? "bg-[#fdf6ee] text-accent dark:bg-neutral-800 dark:text-accent"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          }`}
        >
          {planTier === "concierge" ? "Concierge" : "Standard"}
        </span>
        {companyUserId && (
          <select
            className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-900 shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            value={planTier}
            disabled={tierPending}
            onChange={(e) => onSetPlanTier(e.target.value as "free" | "concierge")}
          >
            <option value="free">Standard</option>
            <option value="concierge">Concierge</option>
          </select>
        )}
      </div>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        Report status: <span className="font-medium">{reportStatus}</span>
      </p>

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {(fullCycle || reviewerOnly) && (
        <p className="mb-6 text-xs text-neutral-500 dark:text-neutral-400">
          {reviewerOnly && (
            <>
              Reviewer time (queue → {timing.approvedAt ? "approval" : "now"}): <span className="font-medium">{reviewerOnly}</span>
              {" · "}
            </>
          )}
          {fullCycle && (
            <>
              Full audit cycle (submission → {timing.approvedAt ? "approval" : "now"}): <span className="font-medium">{fullCycle}</span>
            </>
          )}
        </p>
      )}
    </>
  );
}
