"use client";

// Working prototype of the submit -> edit-window -> review -> delivery flow
// (spec §2.3a, confirmed 2026-07-31). Mock data, compressed/configurable
// timers — NOT connected to Supabase or real evidence intake. Purpose:
// (1) safely test the submit/edit-window/free-tier flow and timing logic
// before any real client sees it, (2) double as a demo for grant/incubator
// applications. Default speed: 1 real second = 1 simulated hour, so the
// real 24h/48h/72h numbers are exactly reproduced at 1/3600 scale — a
// 72-second run-through is literally "the same 72 hours, just faster."

import { useEffect, useRef, useState } from "react";

const EDIT_WINDOW_HOURS = 24;
const REVIEW_WINDOW_HOURS = 48;

const MOCK_COMPANY = {
  name: "Acme Analytics Ltd",
  industry: "B2B SaaS — marketing analytics",
};

const MOCK_EVIDENCE = [
  "Financial: Xero export (P&L, 12 months)",
  "Execution: Jira export (cycle time, backlog)",
  "Commercial: self-report (2 competitors named)",
  "AI & Governance: questionnaire (7 dimensions)",
];

const MOCK_TOP_3 = [
  "Cash runway below critical threshold — 5.5 months against a 6-month floor",
  "Contract approval chain adds ~2 weeks to every deal (CEO sole sign-off)",
  "Pricing pressure from a named competitor's new low-cost tier",
];

type DemoPhase =
  | { kind: "gathering_evidence" }
  | { kind: "edit_window"; deadline: number }
  | { kind: "in_review"; deadline: number }
  | { kind: "delivered" };

interface DeliveredReport {
  cycleNumber: number;
  deliveredAt: Date;
  isPaid: boolean;
}

interface LogEntry {
  time: Date;
  message: string;
}

function remainingLabel(deadline: number, now: number, secondsPerHour: number): string {
  const remainingSeconds = Math.max(0, (deadline - now) / 1000);
  const simulatedHours = remainingSeconds / secondsPerHour;
  const h = Math.floor(simulatedHours);
  const m = Math.max(0, Math.round((simulatedHours - h) * 60));
  return `${h}h ${m}m remaining`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function DemoPage() {
  const [phase, setPhase] = useState<DemoPhase>({ kind: "gathering_evidence" });
  const [secondsPerHour, setSecondsPerHour] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deliveredReports, setDeliveredReports] = useState<DeliveredReport[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const hasUsedFreeTier = deliveredReports.length > 0;

  // Refs mirror the latest state into the interval callback below, so the
  // single long-lived interval (mount-only effect) always sees current
  // values without needing to restart on every state change. Synced via
  // effects, not during render — mutating a ref in the render body itself
  // is disallowed (breaks render purity).
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const secondsPerHourRef = useRef(secondsPerHour);
  useEffect(() => {
    secondsPerHourRef.current = secondsPerHour;
  }, [secondsPerHour]);

  function appendLog(message: string) {
    setLog((prev) => [...prev, { time: new Date(), message }]);
  }

  // All setState calls for deadline-crossing live inside the interval's
  // callback (an external-timer subscription), not the effect body itself —
  // the idiomatic React pattern, and what actually avoids cascading renders
  // (vs. a second effect that re-derives state from a fast-ticking `now`).
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      setNow(nowMs);

      const currentPhase = phaseRef.current;
      const spH = secondsPerHourRef.current;

      if (currentPhase.kind === "edit_window" && nowMs >= currentPhase.deadline) {
        appendLog("Reviewer notified — 24h edit window closed, 48h review period starts now");
        setPhase({ kind: "in_review", deadline: nowMs + REVIEW_WINDOW_HOURS * spH * 1000 });
      } else if (currentPhase.kind === "in_review" && nowMs >= currentPhase.deadline) {
        setDeliveredReports((prev) => [
          ...prev,
          { cycleNumber: prev.length + 1, deliveredAt: new Date(), isPaid: prev.length > 0 },
        ]);
        appendLog("Review complete — report approved (simulated/auto-approved for this demo)");
        appendLog("Report delivered — added to Reports & History");
        setPhase({ kind: "delivered" });
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  function handleConfirmSubmit() {
    setShowConfirm(false);
    appendLog(`Submitted for review${hasUsedFreeTier ? " — this is a paid re-audit" : " — this uses the free audit"}`);
    setPhase({ kind: "edit_window", deadline: Date.now() + EDIT_WINDOW_HOURS * secondsPerHour * 1000 });
  }

  function handleNewEvidenceAfterDelivery() {
    appendLog("New evidence uploaded after delivery — starting a new, distinct re-audit cycle (original report untouched)");
    setPhase({ kind: "gathering_evidence" });
  }

  function handleReset() {
    setPhase({ kind: "gathering_evidence" });
    setDeliveredReports([]);
    setLog([]);
    setShowConfirm(false);
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Demo mode.</strong> Mock company/evidence, not connected to Supabase. Timers are compressed and
          configurable below — real durations are 24h edit window + 48h review = 72h total SLA.
        </div>

        <h1 className="mb-1 text-2xl font-semibold">{MOCK_COMPANY.name}</h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">{MOCK_COMPANY.industry}</p>

        <div className="mb-6 flex items-center gap-3 text-sm">
          <label htmlFor="speed" className="text-neutral-600 dark:text-neutral-400">
            Demo speed: 1 real second =
          </label>
          <input
            id="speed"
            type="number"
            min={0.05}
            step={0.05}
            value={secondsPerHour}
            onChange={(e) => setSecondsPerHour(Math.max(0.05, Number(e.target.value) || 1))}
            disabled={phase.kind === "edit_window" || phase.kind === "in_review"}
            className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <span className="text-neutral-600 dark:text-neutral-400">simulated hour(s)</span>
          <button
            onClick={handleReset}
            className="ml-auto rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            Reset demo
          </button>
        </div>

        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          {phase.kind === "gathering_evidence" && (
            <>
              <h2 className="mb-3 font-medium">Evidence gathered so far</h2>
              <ul className="mb-4 list-inside list-disc space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                {MOCK_EVIDENCE.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="mb-4 text-xs text-neutral-500">
                Uploading has no clock — take whatever time you need. The clock starts only on submit.
              </p>
              <button
                onClick={() => setShowConfirm(true)}
                className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
              >
                Submit for Review
              </button>
            </>
          )}

          {phase.kind === "edit_window" && (
            <>
              <h2 className="mb-2 font-medium">Edit window open</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                You can still revise or add evidence. No review activity yet.
              </p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {remainingLabel(phase.deadline, now, secondsPerHour)}
              </p>
            </>
          )}

          {phase.kind === "in_review" && (
            <>
              <h2 className="mb-2 font-medium">Under review</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Edit window closed. Reviewer notified. Report is being finalized.
              </p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {remainingLabel(phase.deadline, now, secondsPerHour)}
              </p>
            </>
          )}

          {phase.kind === "delivered" && (
            <>
              <h2 className="mb-3 font-medium">Report delivered</h2>
              <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                {MOCK_TOP_3.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              <button
                onClick={handleNewEvidenceAfterDelivery}
                className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Upload new evidence (starts a new re-audit cycle)
              </button>
            </>
          )}
        </div>

        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 font-medium">Reports &amp; History</h2>
          {deliveredReports.length === 0 ? (
            <p className="text-sm text-neutral-500">No reports delivered yet.</p>
          ) : (
            <ul className="space-y-2">
              {deliveredReports.map((r) => (
                <li key={r.cycleNumber} className="flex items-center justify-between text-sm">
                  <span>
                    Report #{r.cycleNumber} — delivered {formatClock(r.deliveredAt)}
                  </span>
                  <span
                    className={
                      r.isPaid
                        ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300"
                    }
                  >
                    {r.isPaid ? "Paid re-audit" : "Free audit"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 font-medium">Event log</h2>
          {log.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {log.map((entry, i) => (
                <li key={i} className="font-mono text-xs">
                  <span className="text-neutral-400 dark:text-neutral-600">{formatClock(entry.time)}</span>{" "}
                  {entry.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 dark:bg-neutral-900">
            <h3 className="mb-3 font-medium">Ready to submit?</h3>
            <p className="mb-5 text-sm text-neutral-600 dark:text-neutral-400">
              You&apos;ll have 24 hours to edit or add evidence — after that, review begins, and your report will be
              ready within 72 hours total.{" "}
              {hasUsedFreeTier ? "This will use paid re-audit pricing." : "This will use your free audit."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
