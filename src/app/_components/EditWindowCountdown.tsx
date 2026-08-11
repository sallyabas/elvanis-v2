"use client";

import { useEffect, useState } from "react";

/**
 * Real live countdown (confirmed 2026-08-10, live testing pass) — closes
 * a real gap: the post-submission confirmation was a one-time message
 * ("Your evidence is saved") with no ongoing indication of how much of
 * the edit window is actually left. A client checking back later had no
 * way to tell "plenty of time" from "closes in 10 minutes" without doing
 * the math themselves. Ticks client-side (this page is otherwise a
 * Server Component — see NextStepBanner.tsx) against the real
 * edit_window_closes_at value, not a locally-simulated timer.
 *
 * Refreshes every 30s, not every second — the display granularity is
 * minutes, so anything faster would just be extra re-renders with no
 * visible difference most of the time. Still genuinely "live": leaving
 * this open and coming back a few minutes later shows a different,
 * correct number without a page reload.
 */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "closed";
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function EditWindowCountdown({ closesAt }: { closesAt: string }) {
  const target = new Date(closesAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const remaining = target - now;
  return (
    <span className="font-medium tabular-nums" aria-live="polite">
      {formatRemaining(remaining)}
    </span>
  );
}
