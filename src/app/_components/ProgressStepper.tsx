import type { JourneyStatus } from "@/lib/reports/journey-status";

/**
 * Persistent 4-step progress indicator (confirmed 2026-08-07, founder's
 * chosen option after the NextStepBanner fixes) — closes the broader "user
 * didn't know the flow" gap: NextStepBanner tells a client what to do next
 * on the page they're already on, but nothing showed where that fits in
 * the overall journey. Deterministic, reuses the same computeJourneyStatus
 * signal NextStepBanner already reads (no separate state to drift).
 *
 * Deliberately just 4 fixed named steps (Profile → Evidence → Under Review →
 * Report), not a generic configurable stepper — this app has exactly one
 * core journey to show, not several. "Profile" is always shown as done:
 * every page this renders on already requires a real `companies` row to
 * exist (enforced by the (app) layout), so by construction the visitor has
 * always completed at least the minimal profile step to get here.
 *
 * Third step relabeled "Review" -> "Under Review" (confirmed 2026-09-02,
 * real UX-pass finding) — "Review" alone reads ambiguously as "you review
 * your own submission" (the far more common meaning of a bare "Review"
 * step in a multi-step form), when this step actually always means "your
 * reviewer is looking at it" (this app has no client-facing
 * confirm-your-answers screen at all — evidence goes straight from Evidence
 * to a human reviewer once the edit window closes). "Under Review" reads
 * unambiguously as something happening to the submission, done by someone
 * else, matching every other place in this file's own history that already
 * uses that exact phrasing for this same concept (e.g. journey-status.ts's
 * "in_review" stage name).
 */
const STEPS = ["Profile", "Evidence", "Under Review", "Report"] as const;

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
  // Real bug found and fixed (confirmed 2026-08-15, Dashboard/module fixes
  // review): `done = i < current` can never be true for the LAST step when
  // `current` equals that step's own index — a genuine off-by-one, not
  // specific to any one stage. For "has_report" specifically, the journey
  // is actually complete (there is no stage after it), so the final step
  // itself should read as done/checkmarked, not as "current, still in
  // progress." isJourneyComplete captures exactly that one case.
  const isJourneyComplete = journeyStatus.stage === "has_report";

  return (
    <ol className="mb-6 flex flex-wrap items-center gap-y-2 text-xs" aria-label="Audit progress">
      {STEPS.map((label, i) => {
        const done = i < current || (isJourneyComplete && i === current);
        const isCurrent = i === current && !isJourneyComplete;
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
