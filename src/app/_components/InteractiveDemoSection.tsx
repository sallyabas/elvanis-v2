"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Embedded, self-contained "watch it work" section (confirmed 2026-08-07,
 * generalized 2026-09-01 for the landing page rebuild). Originally built
 * with one hardcoded step sequence (the Execution Audit / Core Audit
 * flow); now takes `steps` as a prop so the AI Readiness Review rebuild
 * can reuse the exact same tab/autoplay/keyboard-nav mechanism with its
 * own content, instead of a second, drifting copy of this component.
 *
 * Per-step visuals are passed in as `visual: ReactNode` — each caller
 * decides whether a given step is an illustrative schematic (fast,
 * consistent, no staleness risk — appropriate for a short "answer 3
 * questions" step that doesn't compress well as a literal capture) or a
 * real-content reproduction using the app's own real CSS/data (see the
 * landing page's own docblock for why this session's tooling couldn't
 * export a literal raster screenshot, and what was done instead).
 */

const AUTOPLAY_MS = 4500;

export interface DemoStep {
  eyebrow: string;
  label: string;
  title: string;
  body: string;
  visual: ReactNode;
}

export function InteractiveDemoSection({ steps }: { steps: DemoStep[] }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Re-runs on every activeStep change, giving each step its own fresh
  // AUTOPLAY_MS window rather than one global ticking clock — advancing,
  // then looping back to step 0, for as long as isPlaying stays true.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setTimeout(() => {
      setActiveStep((s) => (s + 1) % steps.length);
    }, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [isPlaying, activeStep, steps.length]);

  function goTo(i: number) {
    setActiveStep(i);
    setIsPlaying(false);
  }
  function next() {
    setActiveStep((s) => (s + 1) % steps.length);
    setIsPlaying(false);
  }
  function prev() {
    setActiveStep((s) => (s - 1 + steps.length) % steps.length);
    setIsPlaying(false);
  }

  const step = steps[activeStep];

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => goTo(i)}
            aria-current={i === activeStep}
            className={`min-w-[7rem] flex-1 rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
              i === activeStep ? "bg-neutral-900 text-neutral-50" : "bg-white text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-70">{s.eyebrow}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:items-center">
        <div>
          <h3 className="text-lg font-medium text-neutral-900">{step.title}</h3>
          <p className="mt-2 text-sm text-neutral-600">{step.body}</p>
        </div>
        <div>{step.visual}</div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous step"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-accent hover:text-accent"
        >
          ← Previous
        </button>
        {isPlaying ? (
          <span className="text-xs text-neutral-400">Auto-playing…</span>
        ) : (
          <button type="button" onClick={() => setIsPlaying(true)} className="text-xs text-neutral-500 underline hover:text-accent">
            ▶ Resume auto-play
          </button>
        )}
        <button
          type="button"
          onClick={next}
          aria-label="Next step"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-accent hover:text-accent"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
