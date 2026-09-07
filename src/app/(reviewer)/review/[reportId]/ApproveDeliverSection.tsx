import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

export function ApproveDeliverSection({
  blockedReason,
  pending,
  reportStatus,
  onApprove,
  deliverError,
  delivered,
  onDeliver,
}: {
  blockedReason: string | null;
  pending: boolean;
  reportStatus: string;
  onApprove: () => void;
  deliverError: string | null;
  delivered: boolean;
  onDeliver: () => void;
}) {
  return (
    <>
      <Card>
        {blockedReason && (
          <Alert variant="warning" className="mb-3">
            {blockedReason}
          </Alert>
        )}
        {/* "Already approved" text (confirmed 2026-09-03, direct founder
            feedback) — only swapped in for the reason that actually
            matters here (the report has moved past pending_review, i.e.
            genuinely already approved), not for the unrelated `pending`
            in-flight-click case, which keeps the normal label — a
            reviewer mid-click doesn't need to be told "already approved"
            for a report that isn't. */}
        <Button disabled={pending || reportStatus !== "pending_review"} onClick={onApprove}>
          {reportStatus !== "pending_review" ? "Already approved" : "Approve report"}
        </Button>
      </Card>

      {/* Real "Deliver" button (confirmed 2026-08-06) — closes the gap flagged across multiple end-to-end passes where deliverReport() had no UI caller. */}
      <Card title="Deliver to client" className="mt-6">
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Makes the report visible to the client and logs a real &quot;report ready&quot; notification. Separate from Approve on
          purpose — the report is reviewer-done but not yet client-visible until this step.
        </p>
        {deliverError && (
          <Alert variant="error" className="mb-3">
            {deliverError}
          </Alert>
        )}
        {delivered || reportStatus === "sent" ? (
          <p className="text-sm text-green-700 dark:text-green-400">Delivered — the client can now see this report.</p>
        ) : (
          <>
            <Button disabled={pending || reportStatus !== "approved"} onClick={onDeliver}>
              Deliver report
            </Button>
            {/* Real, disclosed condition (confirmed 2026-09-03) — only
                shown for the actual reason the button is inactive here
                (not yet approved), not for the unrelated in-flight
                `pending` case. */}
            {reportStatus !== "approved" && (
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">Available after the report is approved.</p>
            )}
          </>
        )}
      </Card>
    </>
  );
}
