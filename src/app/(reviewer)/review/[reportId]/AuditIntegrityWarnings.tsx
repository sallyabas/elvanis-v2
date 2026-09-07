import { Alert } from "@/app/_components/ui/Alert";
import type { LensType } from "@/lib/lenses/types";
import { LENS_LABELS, type Props } from "./types";

/**
 * ReviewWorkspaceClient.tsx decomposition (confirmed 2026-09-07) — three
 * pre-flight integrity signals shown together, back to back, in the
 * original JSX: a failed-lens hard block, a zero-findings soft warning,
 * and the regulatory-staleness ambient signal. None alone justifies its
 * own file; bundled here since they share no logic beyond "shown before
 * the reviewer starts deciding anything."
 *
 * Real gap closed (confirmed 2026-09-03, direct founder decision
 * following a full investigation into Groq failure handling) — the
 * mandatory-decision banner (its own section) covers "findings exist but
 * aren't decided yet"; this covers "this audit is missing entire lenses"
 * or "this audit produced nothing at all," both of which previously
 * passed the approval gate silently. Two distinct treatments, per the
 * confirmed design: a failed lens is a HARD block (server-side too, see
 * approveReport()) since the report is provably incomplete — no override,
 * only "Re-run analysis" (its own section). Zero findings with no lens
 * failure is a real, reachable state (confirmed: no lens schema requires
 * at least one finding, and none has a deterministic fallback forcing
 * one) but not necessarily wrong — a genuinely clean audit is possible —
 * so it's a visible warning only; Approve stays enabled and the
 * reviewer's own judgment decides.
 *
 * Regulatory staleness — migrated 2026-09-05 to a real RED (overdue)/
 * AMBER (due soon) two-tier treatment, reading from regulatory_frameworks
 * — one Alert per stale framework, per the brief's own explicit "if
 * multiple frameworks are stale, show one banner per stale framework"
 * instruction, rather than one combined list. Still deliberately framed
 * as an AMBIENT signal about the company's profile, never a claim that
 * this report's own findings address these frameworks — the core audit
 * doesn't do formal jurisdiction determination, that's the standalone
 * modules' job. Reviewer-only, never client-facing. Links to the
 * standalone admin page.
 */
export function AuditIntegrityWarnings({
  failedLenses,
  hasNoFindings,
  regulatoryStalenessWarnings,
}: {
  failedLenses: string[];
  hasNoFindings: boolean;
  regulatoryStalenessWarnings: Props["regulatoryStalenessWarnings"];
}) {
  return (
    <>
      {failedLenses.length > 0 && (
        <section className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-card-1 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">
            {failedLenses.length} lens{failedLenses.length === 1 ? "" : "es"} failed to generate during this audit:{" "}
            {failedLenses.map((l) => LENS_LABELS[l as LensType] ?? l).join(", ")}.
          </p>
          <p className="mt-1">
            This report is genuinely incomplete, not just thin — approval is blocked. Re-run the analysis below rather than deliver a report
            missing whole sections with no disclosure.
          </p>
        </section>
      )}

      {failedLenses.length === 0 && hasNoFindings && (
        <Alert variant="warning" className="mb-6">
          No findings were generated — all lenses ran successfully. Confirm this is genuinely correct before approving.
        </Alert>
      )}

      {regulatoryStalenessWarnings.map((w) => (
        <Alert key={w.shortCode} variant={w.status === "red" ? "warning" : "info"} className="mb-6">
          {w.status === "red" ? (
            <p>
              ⚠️ Framework review overdue: <strong>{w.label}</strong>{" "}
              {w.daysSinceReview === null ? "has not yet been reviewed under this tracker" : `was last reviewed ${w.daysSinceReview} days ago`}.
              Consider checking for regulatory updates before approving this report.
            </p>
          ) : (
            <p>
              ℹ️ Framework review due soon: <strong>{w.label}</strong> is coming up for review.
            </p>
          )}
          <p className="mt-1 text-xs italic">
            An ambient signal from the company&apos;s current registration/customer-market profile, not a claim that this report&apos;s own
            findings address this framework — this audit doesn&apos;t perform formal jurisdiction determination.{" "}
            <a href="/admin/regulatory-frameworks" className="underline">
              View the regulatory framework tracker →
            </a>
          </p>
        </Alert>
      ))}
    </>
  );
}
