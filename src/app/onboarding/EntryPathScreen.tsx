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
            // Copper left border on the AI Compliance Audit card only
            // (confirmed 2026-09-03, direct founder feedback: "it is the
            // primary commercial offer and should look like it") — a real
            // border-l-[3px] with the exact brand hex, not the accessible
            // accent-cta substitute used for TEXT/button contrast
            // elsewhere, since this is a purely decorative border, not
            // something needing WCAG text-contrast math.
            className={`w-full rounded-lg border bg-white p-4 text-left shadow-card-1 transition-all hover:shadow-card-2 dark:bg-neutral-900 dark:hover:bg-neutral-800 ${
              opt.key === "ai_audit"
                ? "border-neutral-200 border-l-[3px] border-l-[#B87333] hover:border-accent dark:border-neutral-700"
                : "border-neutral-200 hover:border-accent dark:border-neutral-700"
            }`}
          >
            <p className="font-medium text-neutral-900 dark:text-neutral-50">{opt.label}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{opt.supportingLine}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
