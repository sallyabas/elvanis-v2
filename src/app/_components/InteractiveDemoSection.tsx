"use client";

import { useEffect, useState } from "react";

/**
 * Embedded, self-contained "watch it work" section (confirmed 2026-08-07)
 * — replaces the landing page's previous "Interactive demo" card, which
 * just linked out to /demo (the separate, timer-compressed mock
 * prototype). The founder asked for a tabbed, auto-playing sequence
 * directly on the page itself — no navigation, no sign-in — citing the old
 * Elvanis site's equivalent section as a functional reference for the
 * PATTERN only (tabs + autoplay + arrows). Built fresh here, in this
 * codebase's own voice and copy — the old Elvanis app/site is separate
 * infrastructure this project deliberately never reuses content from (see
 * CLAUDE.md's "relaunch decision" section).
 *
 * The four step visuals below are illustrative schematic mockups (styled
 * divs using real product terminology already used elsewhere on this page
 * — lens names, Accept/Edit/Reject, Top 3 priorities, 30/60/90), not
 * screenshots claiming to be literal captures of the app.
 */

const AUTOPLAY_MS = 4500;

interface DemoStep {
  eyebrow: string;
  label: string;
  title: string;
  body: string;
}

const STEPS: DemoStep[] = [
  {
    eyebrow: "Step 1",
    label: "Submit evidence",
    title: "You submit your evidence, per lens",
    body: "Your own native exports (Xero, HubSpot, Jira, and more) or a short guided form — Financial, Execution, Product, Commercial, and AI & Governance. Leaving a field blank is meaningful too, not a failed submission.",
  },
  {
    eyebrow: "Step 2",
    label: "Five lenses draft",
    title: "Five AI lenses draft findings, independently",
    body: "Each lens reads your goal and your evidence, and drafts its own findings in parallel — no lens sees or influences another lens's output.",
  },
  {
    eyebrow: "Step 3",
    label: "Human review",
    title: "A reviewer accepts, edits, or rejects every one",
    body: "Nothing reaches you AI-only. Every single drafted finding is checked by a person before it's ever shown to a client — enforced at the system level, not a policy we just say we follow.",
  },
  {
    eyebrow: "Step 4",
    label: "Report delivered",
    title: "You get your top 3 priorities and a 30/60/90 plan",
    body: "Each priority comes with a financial impact estimate and a concrete roadmap you can hand straight to your team — ready within 72 hours.",
  },
];

function StepVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="space-y-2">
        <div className="rounded border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <p className="font-medium text-neutral-500 dark:text-neutral-400">Financial</p>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">Gross margin trend: holding steady around 68%...</p>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <p className="font-medium text-neutral-500 dark:text-neutral-400">Execution</p>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">Meeting load: roughly 14 hours/week across leadership...</p>
        </div>
        <div className="text-right">
          <span className="inline-block rounded bg-accent px-3 py-1 text-xs font-medium text-accent-ink">Submit for review</span>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="grid grid-cols-5 gap-2">
        {["Financial", "Commercial", "Execution", "Product", "AI & Gov"].map((l) => (
          <div
            key={l}
            className="flex flex-col items-center gap-1.5 rounded border border-neutral-200 bg-white p-2 text-center dark:border-neutral-700 dark:bg-neutral-900"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="text-[10px] leading-tight text-neutral-600 dark:text-neutral-400">{l}</span>
          </div>
        ))}
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="rounded border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
        <p className="text-xs font-medium text-neutral-900 dark:text-neutral-50">Gross Margin Trend</p>
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">Gross margin has held steady around 68%, roughly flat quarter over quarter.</p>
        <div className="mt-3 flex gap-2 text-xs">
          <span className="rounded bg-accent px-2 py-1 font-medium text-accent-ink">✓ Accept</span>
          <span className="rounded border border-neutral-300 px-2 py-1 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Edit</span>
          <span className="rounded border border-neutral-300 px-2 py-1 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Reject</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="rounded border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
        <p className="font-medium text-neutral-500 dark:text-neutral-400">Top 3 priorities</p>
        <ol className="mt-1 list-inside list-decimal text-neutral-700 dark:text-neutral-300">
          <li>Gross Margin Trend</li>
          <li>Cash Flow Runway</li>
          <li>Hosting &amp; Support Costs</li>
        </ol>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-neutral-600 dark:text-neutral-400">
        {["30 days", "60 days", "90 days"].map((d) => (
          <div key={d} className="rounded border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InteractiveDemoSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Re-runs on every activeStep change, giving each step its own fresh
  // AUTOPLAY_MS window rather than one global ticking clock — advancing,
  // then looping back to step 0, for as long as isPlaying stays true.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setTimeout(() => {
      setActiveStep((s) => (s + 1) % STEPS.length);
    }, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [isPlaying, activeStep]);

  function goTo(i: number) {
    setActiveStep(i);
    setIsPlaying(false);
  }
  function next() {
    setActiveStep((s) => (s + 1) % STEPS.length);
    setIsPlaying(false);
  }
  function prev() {
    setActiveStep((s) => (s - 1 + STEPS.length) % STEPS.length);
    setIsPlaying(false);
  }

  const step = STEPS[activeStep];

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/40 sm:p-8">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => goTo(i)}
            aria-current={i === activeStep}
            className={`min-w-[7rem] flex-1 rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
              i === activeStep
                ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "bg-white text-neutral-500 hover:text-neutral-900 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-70">{s.eyebrow}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:items-center">
        <div>
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">{step.title}</h3>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{step.body}</p>
        </div>
        <div>
          <StepVisual step={activeStep} />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous step"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-accent hover:text-accent dark:border-neutral-700 dark:text-neutral-400"
        >
          ← Previous
        </button>
        {isPlaying ? (
          <span className="text-xs text-neutral-400">Auto-playing…</span>
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="text-xs text-neutral-500 underline hover:text-accent dark:text-neutral-400"
          >
            ▶ Resume auto-play
          </button>
        )}
        <button
          type="button"
          onClick={next}
          aria-label="Next step"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-accent hover:text-accent dark:border-neutral-700 dark:text-neutral-400"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
