import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/** Basic re-run/refresh button (confirmed 2026-08-05) — reviewer-triggered, see rerun-audit.ts for why. */
export function RerunAnalysisSection({
  rerunOfReportId,
  canRerun,
  rerunError,
  rerunResultId,
  pending,
  onRerun,
}: {
  rerunOfReportId: string | null;
  canRerun: boolean;
  rerunError: string | null;
  rerunResultId: string | null;
  pending: boolean;
  onRerun: () => void;
}) {
  return (
    <Card title="Re-run analysis" className="mt-6">
      {rerunOfReportId && (
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
          This report is itself a re-run of{" "}
          <a href={`/review/${rerunOfReportId}`} className="font-medium text-accent hover:underline">
            an earlier report
          </a>
          .
        </p>
      )}
      {canRerun ? (
        <>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Re-executes all five lenses fresh against the same evidence, using the company&apos;s current profile. Produces a new report in pending review — the mandatory review gate applies to it exactly as it does to this one.
          </p>
          {rerunError && (
            <Alert variant="error" className="mb-3">
              {rerunError}
            </Alert>
          )}
          {rerunResultId ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              New report created —{" "}
              <a href={`/review/${rerunResultId}`} className="font-medium text-accent hover:underline">
                open it
              </a>
              .
            </p>
          ) : (
            <Button variant="secondary" disabled={pending} onClick={onRerun}>
              Re-run analysis
            </Button>
          )}
        </>
      ) : (
        // Reviewer-audience copy, confirmed 2026-09-03 — this message
        // renders inside the reviewer's OWN workspace (there is no
        // client-facing equivalent of "Re-run analysis" anywhere in the
        // app; confirmed by grep — the client report page has no such
        // feature), so the copy directs the reviewer to ask the client
        // for new evidence, not the other way around.
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Re-run analysis is available on new audits. If the client needs updated findings on this one, ask them to submit new evidence.
        </p>
      )}
    </Card>
  );
}
