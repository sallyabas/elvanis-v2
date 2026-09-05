"use client";

import { Button } from "@/app/_components/ui/Button";

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
          {/* Converted to the shared Button component (confirmed
              2026-09-05, code-quality audit) — an exact color/text match
              to Button's own primary variant, w-full passed via className
              (a layout utility, not a conflicting padding/size one, so
              safe to append). */}
          <Button type="button" className="w-full" onClick={() => onChoose("diagnosis")}>
            Start with this one
          </Button>
        </div>
        {/* Copper left border (confirmed 2026-09-03, same reasoning as the
            entry-path screen's own matching fix) — this is the primary
            commercial offer, given visual priority over Business
            Diagnosis. */}
        <div className="rounded-lg border border-neutral-200 border-l-[3px] border-l-[#B87333] bg-white p-5 shadow-card-1 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">AI Compliance Audit</h2>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            For founders whose AI is already in production, or who&apos;ve received a compliance or procurement request.
            You&apos;ll get an assessment of your AI&apos;s governance gaps, reliability risks, and documentation readiness.
          </p>
          <Button type="button" className="w-full" onClick={() => onChoose("ai_audit")}>
            Start with this one
          </Button>
        </div>
      </div>
    </div>
  );
}
