"use client";

/**
 * Hub page ("I'm not sure yet") — confirmed 2026-08-27, Onboarding
 * Architecture & Path Routing brief, Part 4. Purely a routing aid, no
 * data collection of its own — exact copy specified. Deliberately a
 * shared, presentational component (not a route of its own) since it's
 * used in two real places: embedded within `/onboarding`'s own flow right
 * after a fresh "I'm not sure yet" pick, and embedded inline on the
 * Dashboard (Part 5) for any company whose entry_path is still
 * 'undecided'. Each caller supplies its own `onChoose` — onboarding
 * transitions client-side state directly; Dashboard navigates back into
 * `/onboarding` to resume the chosen path.
 */
export function HubScreen({ onChoose }: { onChoose: (path: "diagnosis" | "ai_audit") => void }) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Which fits you better?</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">You can always change this later.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card-1 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">Business Diagnosis</h2>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            For founders who know their business should be growing faster but can&apos;t pinpoint why. You&apos;ll get a
            diagnosis across five dimensions, a financial impact estimate, and a prioritised 90-day roadmap.
          </p>
          <button
            type="button"
            onClick={() => onChoose("diagnosis")}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
          >
            Start with this one
          </button>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card-1 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">AI Compliance Audit</h2>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            For founders whose AI is already in production, or who&apos;ve received a compliance or procurement request.
            You&apos;ll get an assessment of your AI&apos;s governance gaps, reliability risks, and documentation readiness.
          </p>
          <button
            type="button"
            onClick={() => onChoose("ai_audit")}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
          >
            Start with this one
          </button>
        </div>
      </div>
    </div>
  );
}
