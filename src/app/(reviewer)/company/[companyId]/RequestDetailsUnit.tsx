"use client";

import { useState } from "react";

/**
 * Real, small client component (confirmed 2026-09-08, item 6's per-request
 * <details> collapse) — a real bug found and fixed while verifying this
 * live, not anticipated upfront: if this were a plain Server Component
 * `<details open={expanded}>`, a reviewer action (e.g. Refund) that makes
 * a request newly terminal triggers `revalidatePath()`, which re-renders
 * the whole tree with a NEW, now-`false` `expanded` prop — snapping the
 * panel shut on the reviewer mid-interaction, right after they just acted
 * on it. `useState(expanded)` only reads its initializer once, on
 * mount — a `revalidatePath()`-triggered re-render updates this
 * component's OTHER props/children normally, but never resets `open`
 * back to the server's newly-computed value, so whatever the reviewer
 * actually has expanded/collapsed stays exactly as they left it. A
 * genuine fresh page load/navigation still correctly starts from the
 * server's real computed `expanded` state (isTerminal(), unchanged).
 */
export function RequestDetailsUnit({ expanded, summary, children }: { expanded: boolean; summary: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(expanded);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-md border border-neutral-200 dark:border-neutral-800">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50 [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div className="space-y-3 border-t border-neutral-100 px-3 py-3 dark:border-neutral-900">{children}</div>
    </details>
  );
}
