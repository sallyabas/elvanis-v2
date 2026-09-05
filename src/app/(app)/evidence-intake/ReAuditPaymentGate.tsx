"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";

/**
 * Re-audit payment gate (confirmed 2026-09-06, direct founder spec) —
 * shown every time a client with a prior sent report lands on
 * /evidence-intake before they've started their new cycle. No counter, no
 * persisted "seen it" flag (confirmed decision — deliberately re-shown on
 * every such visit, not a one-time thing).
 *
 * Acknowledgment only, not a verified-payment check (confirmed decision)
 * — "Continue to Payment" opens the real Payoneer link and immediately
 * reveals the form regardless of whether payment has actually cleared at
 * that moment; the real enforcement is the pre-audit hold this same
 * feature builds elsewhere (see run-pending-audits.ts's own payment_status
 * guard) — once the client's edit window closes, the audit itself won't
 * run until a reviewer marks this specific submission paid, no matter
 * what happened at this gate. This popup is a friction/awareness step,
 * not the actual gate.
 *
 * "Cancel" navigates away (confirmed decision) rather than silently
 * revealing the form — dismissing this step should mean "not right now,"
 * not "let me see the form anyway."
 */
export function ReAuditPaymentGate({ priceLabel, paymentLink, children }: { priceLabel: string; paymentLink: string; children: React.ReactNode }) {
  const [passed, setPassed] = useState(false);
  const router = useRouter();

  if (passed) return <>{children}</>;

  return (
    <Card title="This is a paid re-audit" level={2}>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        Your free first audit has already been used. A re-audit is <span className="font-semibold text-neutral-900 dark:text-neutral-50">{priceLabel}</span> —
        deliberately priced below the real time it takes, since re-auditing regularly is how you actually see
        progress over time.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
          Cancel
        </Button>
        <a
          href={paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setPassed(true)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Continue to Payment
        </a>
      </div>
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Opens Payoneer in a new tab — you can fill in your evidence below regardless of where payment stands right
        now. Your reviewer confirms payment before the analysis actually runs.
      </p>
    </Card>
  );
}
