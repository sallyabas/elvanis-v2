"use client";

/**
 * Post-signup routing screen (confirmed 2026-08-27, Onboarding
 * Architecture & Path Routing brief, Part 1) — the exact copy specified,
 * three large clickable cards, not a dropdown or radio group. Shown
 * exactly once, before any profile form, only ever reachable from
 * `/onboarding` when the signed-in user has no company row yet (see that
 * page's own gating logic) — so "do not show to returning users who
 * already made a choice" is already structurally guaranteed rather than
 * checked here.
 */

const OPTIONS = [
  {
    key: "diagnosis" as const,
    label: "Run a business diagnosis",
    supportingLine: "Find out what's blocking your growth and what to fix first",
  },
  {
    key: "ai_audit" as const,
    label: "Get an AI compliance audit",
    supportingLine: "Prove your AI is safe, reliable, and procurement-ready",
  },
  {
    key: "undecided" as const,
    label: "I'm not sure yet",
    supportingLine: "Show me both options and I'll decide",
  },
];

export function EntryPathScreen({ onChoose }: { onChoose: (choice: "diagnosis" | "ai_audit" | "undecided") => void }) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">What brings you here today?</h1>
      </div>
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChoose(opt.key)}
            className="w-full rounded-lg border border-neutral-300 bg-white p-4 text-left transition-colors hover:border-accent hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <p className="font-medium text-neutral-900 dark:text-neutral-50">{opt.label}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{opt.supportingLine}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
