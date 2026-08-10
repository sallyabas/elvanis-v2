import type { JourneyStatus } from "@/lib/reports/journey-status";

/**
 * Persistent 4-step progress indicator (confirmed 2026-08-07, founder's
 * chosen option after the NextStepBanner fixes) — closes the broader "user
 * didn't know the flow" gap: NextStepBanner tells a client what to do next
 * on the page they're already on, but nothing showed where that fits in
 * the overall journey. Deterministic, reuses the same computeJourneyStatus
 * signal NextStepBanner already reads (no separate state to drift).
 *
 * Deliberately just 4 fixed named steps (Profile → Evidence → Review →
 * Report), not a generic configurable stepper — this app has exactly one
 * core journey to show, not several. "Profile" is always shown as done:
 * every page this renders on already requires a real `companies` row to
 * exist (enforced by the (app) layout), so by construction the visitor has
 * always completed at least the minimal profile step to get here.
 */
const STEPS = ["Profile", "Evidence", "Review", "Report"] as const;

function currentStepIndex(stage: JourneyStatus["stage"]): number {
  switch (stage) {
    case "no_evidence":
      return 1; // Evidence
    case "editing":
      // Delayed-execution architecture (confirmed 2026-08-10) — evidence
      // is submitted but still genuinely editable, no audit has run yet.
      // Still the Evidence step, same as no_evidence.
      return 1; // Evidence
    case "queued_for_audit":
    case "audit_in_progress":
    case "in_review":
      // All three land on "Review": the client's own part is done (their
      // window has closed), and this step already conflated "the audit
      // runs" with "a human reviews it" as one visual step before this
      // date — queued/in-progress audit execution fits the same slot.
      return 2; // Review
    case "has_report":
      return 3; // Report
  }
}

export function ProgressStepper({ journeyStatus }: { journeyStatus: JourneyStatus }) {
  const current = currentStepIndex(journeyStatus.stage);

  return (
    <ol className="mb-6 flex flex-wrap items-center gap-y-2 text-xs" aria-label="Audit progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li key={label} className="flex items-center">
            <span className="flex items-center gap-1.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                  done
                    ? "bg-accent text-accent-ink"
                    : isCurrent
                      ? "border-2 border-accent text-accent"
                      : "border border-neutral-300 text-neutral-400 dark:border-neutral-700 dark:text-neutral-600"
                }`}
                aria-hidden="true"
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={
                  isCurrent
                    ? "font-medium text-neutral-900 dark:text-neutral-50"
                    : done
                      ? "text-neutral-600 dark:text-neutral-400"
                      : "text-neutral-400 dark:text-neutral-600"
                }
              >
                {label}
                {isCurrent && <span className="sr-only"> (current step)</span>}
              </span>
            </span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px w-6 bg-neutral-300 dark:bg-neutral-700" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
