import { AiReliabilityIntakeForm } from "./AiReliabilityIntakeForm";

/**
 * Real root cause found in production 2026-08-15 (see tender-readiness's
 * page.tsx for the full writeup) — same fix applied here: a real,
 * synchronous Groq call with no `maxDuration` configured risks being
 * killed by the platform's default serverless timeout mid-flight.
 */
export const maxDuration = 60;

// AI Reliability Audit — standalone entry page, sellable independent of the
// core audit. See spec §1.7a for the confirmed design (evidence-based, no
// live execution, system-type-branching intake).
//
// KNOWN GAP, FLAGGED NOT SILENTLY SHIPPED: no client-auth system exists yet
// (only reviewer auth does) — same interim `?companyId=` addressing scheme
// as Business Profile's desired-future-state field, for the same reason.
export default async function AiReliabilityAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;

  if (!companyId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">AI Reliability Audit</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No company specified. Visit this page with <code>?companyId=&lt;id&gt;</code> — session-based lookup
          isn&apos;t built yet (no client-auth system exists).
        </p>
      </div>
    );
  }

  return <AiReliabilityIntakeForm companyId={companyId} />;
}
