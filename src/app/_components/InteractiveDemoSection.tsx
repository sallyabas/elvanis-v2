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
 *
 * Dark-frame styling (confirmed 2026-09-02, item 5) — this component's
 * one current call site now sits on a dark #1C2033 section background,
 * so the outer widget frame (previously bg-neutral-50, near-white) and
 * the tab/prev/next chrome around the white active-step panel were
 * recolored to sit correctly on dark: a subtle white-tinted frame
 * (bg-white/5, border-white/10) instead of a solid light box, light-grey
 * inactive tabs, and an accent-colored active tab (the old bg-neutral-900
 * active state would have been nearly invisible against #1C2033). The
 * active-step panel itself is untouched — it was already a real white
 * card with its own shadow before this pass, exactly what "the demo
 * panel itself stays white with shadow" asks for. Hardcoded for this
 * dark context rather than given a light/dark variant prop — there is
 * only one real call site today; a future light-background reuse would
 * need this revisited, flagged here rather than over-engineered now.
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
    <div className="rounded-lg border border-white/10 bg-white/5 p-8 sm:p-10">
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => goTo(i)}
            aria-current={i === activeStep}
            className={`min-w-[8rem] flex-1 rounded px-4 py-3 text-left text-sm font-medium transition-colors ${
              i === activeStep ? "bg-accent-cta text-white" : "bg-white/10 text-neutral-200 hover:bg-white/15 hover:text-white"
            }`}
          >
            <span className="block text-xs uppercase tracking-wide opacity-70">{s.eyebrow}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Active step panel, strengthened (confirmed 2026-09-02, direct
          founder fix — "this section needs to feel like the most
          trustworthy moment on the page"): a real white card with an
          exact rgba shadow (0 4px 12px rgba(0,0,0,0.08), the precise
          value requested — close to but deliberately not substituted
          with this app's own shadow-card-2 token, which uses a slightly
          higher 0.1 alpha), lifted off the neutral-50 widget frame
          behind it rather than sitting flush with it. */}
      <div className="mt-8 grid gap-8 rounded-lg bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)] sm:grid-cols-2 sm:items-center sm:p-8">
        <div>
          <h3 className="text-xl font-medium text-neutral-900 sm:text-2xl">{step.title}</h3>
          <p className="mt-3 text-base text-neutral-600">{step.body}</p>
        </div>
        <div>{step.visual}</div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous step"
          className="rounded border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:border-accent-cta hover:text-accent-cta"
        >
          ← Previous
        </button>
        {isPlaying ? (
          <span className="text-sm text-neutral-300">Auto-playing…</span>
        ) : (
          <button type="button" onClick={() => setIsPlaying(true)} className="text-sm text-neutral-300 underline hover:text-accent-cta">
            ▶ Resume auto-play
          </button>
        )}
        <button
          type="button"
          onClick={next}
          aria-label="Next step"
          className="rounded border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:border-accent-cta hover:text-accent-cta"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
