import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { type FindingRow, displayedContent } from "./types";

/**
 * Execution Sprint entry point (confirmed 2026-08-06, split into a real
 * client-confirmation step 2026-08-18 — direct founder question, "does
 * the client see any confirmation before a sprint formally begins?"
 * confirmed no, closed the gap) — reviewer-triggered from an approved/
 * edited finding, no in-app checkout (payment confirmed externally
 * first).
 */
export function ExecutionSprintProposalSection({
  reportStatus,
  sprintError,
  undisputedFindings,
  pending,
  startingSprintFor,
  onStartSprint,
}: {
  reportStatus: string;
  sprintError: string | null;
  undisputedFindings: FindingRow[];
  pending: boolean;
  startingSprintFor: string | null;
  onStartSprint: (findingId: string) => void;
}) {
  if (reportStatus !== "approved" && reportStatus !== "sent") return null;
  return (
    <Card title="Propose an Execution Sprint" className="mt-6">
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        A bounded 2-4 week paid implementation engagement fixing ONE finding below — only once payment is
        confirmed outside the app. Proposes the sprint to the client for confirmation first — once they confirm
        (or pick a different finding they&apos;d previously marked &quot;interested in help&quot; on), you&apos;ll
        land on a review pass before the client ever sees the actual task plan.
      </p>
      {sprintError && (
        <Alert variant="error" className="mb-3">
          {sprintError}
        </Alert>
      )}
      <ul className="space-y-2">
        {undisputedFindings
          .filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited")
          .map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 text-sm text-neutral-800 dark:text-neutral-200">
              <span>{displayedContent(f).title}</span>
              <Button
                variant="secondary"
                disabled={pending || startingSprintFor !== null}
                onClick={() => onStartSprint(f.id)}
                className="shrink-0 px-2 py-1 text-xs"
              >
                {startingSprintFor === f.id ? "Proposing…" : "Propose Execution Sprint"}
              </Button>
            </li>
          ))}
      </ul>
    </Card>
  );
}
