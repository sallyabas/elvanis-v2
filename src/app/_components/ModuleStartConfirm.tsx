"use client";

import { Button } from "@/app/_components/ui/Button";

/**
 * Lightweight confirmation interstitial for the direct-module-click path
 * (confirmed 2026-08-31, sidebar rework, item 6) — when a client clicks a
 * named module directly from the sidebar (skipping the AI Audit triage
 * flow entirely, per the founder's own confirmed rule 3), the very next
 * thing they see should still not be a bare intake form with zero
 * confirmation of what they're about to start. Same "never silently
 * redirect" principle as PathBWizard's own recommendation screen, applied
 * to the path that bypasses that screen altogether.
 */
export function ModuleStartConfirm({ label, description, onContinue }: { label: string; description: string; onContinue: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card-1">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">You&apos;re starting</p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">{label}</h1>
        <p className="mt-2 text-sm text-neutral-600">{description}</p>
      </div>
      <Button type="button" onClick={onContinue} className="w-full">
        Continue
      </Button>
    </div>
  );
}
