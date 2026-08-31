"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/_components/ui/Button";

/**
 * Locked state for Execution Sprint (confirmed 2026-08-31, sidebar rework
 * item 5) — shown in place of the real card whenever no delivered report
 * exists yet (Execution Sprints are always scoped to a specific finding,
 * so there's genuinely nothing to scope one to before then). A plain
 * Unicode lock glyph, not a new icon-library dependency — same precedent
 * already used elsewhere in this app for lightweight visual markers
 * (⚠ on the AI Reliability misclassification flag).
 */
export function LockedExecutionSprintCard() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-500">
          <span aria-hidden>🔒</span> Execution Sprint — locked
        </span>
        <span className="text-xs text-neutral-400">Unlocked after your first report</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-neutral-600">Complete your first report to unlock Execution Sprint.</p>
          <Button type="button" onClick={() => router.push("/evidence-intake")}>
            Start Now
          </Button>
        </div>
      )}
    </div>
  );
}
