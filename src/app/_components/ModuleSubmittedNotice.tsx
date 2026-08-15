import Link from "next/link";

/**
 * Shared "submitted for review" state for all three standalone module
 * intake forms (confirmed 2026-08-15, module intake/service flow review)
 * — closes three real, confirmed gaps found live:
 *
 * 1. No way to navigate anywhere from this state — dead-ended on the
 *    confirmation message with no back/next-step link. Now links back to
 *    Services.
 * 2. No time estimate for a response, unlike the core audit's prominent
 *    72h SLA. Modules have no formal enforced deadline yet (confirmed by
 *    reading the code — there's no equivalent to reports.review_due_at
 *    for module_requests), so this deliberately doesn't overclaim a hard
 *    guarantee; it reuses the same `review_period_hours` app_setting the
 *    core audit's own review SLA is built from — the same reviewers, a
 *    similar process — framed as a typical, not guaranteed, turnaround.
 * 3. No visible way to ask a question about a submitted request. Uses the
 *    same address already verified and sending real transactional email
 *    in this codebase (RESEND_FROM_EMAIL) — flagged as a default, not
 *    assumed to be the right inbox for this specifically.
 *
 * Also true now, and reflected in the copy: submitting a module request
 * fires a real notification, both to reviewers on submission and to the
 * client on delivery (see notifyReviewersOfNewModuleRequest() and
 * deliverModuleRequest()'s notification insert) — "we'll email you" is
 * genuinely true here, not aspirational copy written ahead of the backend
 * that makes it true.
 *
 * Real bug caught live during verification, not anticipated: "within
 * {reviewPeriodHours} hours" rendered as "48hours" with no space — the
 * exact JSX whitespace-collapse gotcha already documented and fixed
 * elsewhere in this codebase (a text node right after a `{expression}`
 * loses its leading space whenever that node spans multiple SOURCE lines,
 * not multiple rendered lines). Fixed the same way: an explicit `{" "}`
 * after the expression, not relying on a plain space surviving JSX's
 * line-based trimming.
 */
export function ModuleSubmittedNotice({ requestId, reviewPeriodHours }: { requestId: string | null; reviewPeriodHours: number }) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
        Submitted for review. Request ID: {requestId}
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        A reviewer typically responds within {reviewPeriodHours}{" "}
        hours (this is a typical turnaround, not a guaranteed deadline). We&apos;ll email you once your results are
        ready — no need to keep checking back.
      </p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Questions about this request?{" "}
        <a href="mailto:info@app.elvanis.com" className="font-medium text-accent underline hover:text-accent-hover">
          Email us at info@app.elvanis.com
        </a>
        .
      </p>
      <Link href="/services" className="inline-block text-sm font-medium text-accent underline hover:text-accent-hover">
        ← Back to Services
      </Link>
    </div>
  );
}
