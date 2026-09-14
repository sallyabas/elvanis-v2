import Link from "next/link";

/**
 * Shared "submitted" state for all three standalone module intake forms.
 *
 * Rewritten 2026-09-06 for the module payment gate (direct founder
 * decision, exact confirmed copy) — closes a real, confirmed gap: none of
 * the three modules had any payment check before running a real,
 * synchronous Groq call on every submission, at £2,000-£2,500 per
 * request. The request now sits in `awaiting_payment` with NO analysis
 * run yet — the real Groq call only happens once a reviewer marks it
 * paid (see module-payment-gate.ts). This notice's job changed from
 * "your analysis is being reviewed" to "your request is saved, go pay."
 *
 * "or it will remain pending" is the exact confirmed copy — deliberately
 * doesn't promise a deadline or an auto-decline, since none exists; a
 * request sits in `awaiting_payment` indefinitely until a reviewer
 * checks and marks it paid or unpaid.
 *
 * No in-app checkout exists anywhere in this codebase (same disclosed
 * design as Execution Sprint/Concierge) — the real Payoneer link is
 * live and working for two of the three modules (see module-meta.ts).
 *
 * `paymentLink` is nullable (confirmed 2026-09-14) — the AI Reliability
 * Audit link was found live-charging the wrong amount (£2,500 instead
 * of £2,000) during a go-live re-verification pass, and was pulled from
 * every live surface rather than left charging incorrectly while a
 * correctly-priced link is generated. `null` here renders an honest
 * "we'll follow up directly" message instead of a payment button, so a
 * client submitting AI Reliability Audit is never shown a link to the
 * wrong amount.
 */
export function ModuleSubmittedNotice({ paymentLink, priceLabel }: { paymentLink: string | null; priceLabel?: string }) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
        Your request is submitted. Continue to payment now, or it will remain pending.
      </p>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card-1">
        <p className="text-sm text-neutral-600">
          No analysis has started yet — your reviewer confirms payment before the real work begins. Once you&apos;ve paid, we&apos;ll
          take it from there.
        </p>
        {paymentLink ? (
          <a
            href={paymentLink}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
          >
            Continue to payment{priceLabel ? ` — ${priceLabel}` : ""}
          </a>
        ) : (
          <p className="mt-4 text-sm text-neutral-600">
            We&apos;ll follow up directly with how to pay{priceLabel ? ` (${priceLabel})` : ""} — no payment link is available here right
            now.
          </p>
        )}
      </div>
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
