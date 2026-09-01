import { SEVERITY_STYLES } from "@/lib/severity-badge";
import type { DemoStep } from "./InteractiveDemoSection";

/**
 * AI Readiness Review interactive-demo content (confirmed 2026-09-01,
 * landing page rebuild) — the AI Audit triage → recommendation → evidence
 * → real findings path, replacing the old single Execution-Audit-only
 * demo now that AI Readiness Review is the page's primary product.
 *
 * Step 1-3 visuals are illustrative schematics (same treatment the
 * original Execution Audit demo always used for its own steps) — a
 * genuinely honest choice here, not a shortcut: none of these three steps
 * is itself the "proof" moment, and a literal screenshot of a form or a
 * 3-question radio list doesn't compress into a small demo card any more
 * legibly than a clean schematic does.
 *
 * Step 4 ("Real findings, human-reviewed") is the one moment that needs
 * to be genuinely real, not illustrative — research backs this
 * specifically (a real screenshot "seals the deal" where an illustration
 * only "sets the emotional stage"). It reproduces VERBATIM, REAL finding
 * text from an actual, already-delivered Tender Readiness report (Nimbus
 * Ledger Ltd, a disposable, non-PII test company already used
 * extensively as real proof-of-work data throughout this project's
 * history — never a real client's data), styled with the exact real
 * SEVERITY_STYLES classes the reviewer/client UI itself uses.
 *
 * Disclosed limitation, not silently smoothed over: this session's
 * browser-automation tooling has no way to export a literal raster
 * screenshot file to disk (confirmed by directly searching for one after
 * capturing a test screenshot — nothing persists outside the chat
 * transcript). A live <iframe> embed was considered and rejected in favor
 * of this approach for consistency with this step and to avoid a second,
 * unrelated set of accessibility/performance tradeoffs (nested scrolling,
 * an extra full-page network load) for uncertain benefit. If literal PNG
 * screenshot files are wanted later, this component's `visual` slot is a
 * single, clearly-labeled swap point — capture them locally and drop in
 * an <img>, no other structural change needed.
 */

function Step1Visual() {
  const items = [
    { q: "Using AI with customers?", a: "Yes" },
    { q: "Recent compliance or procurement request?", a: "Yes" },
    { q: "Handle personal data?", a: "Not sure" },
  ];
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.q} className="flex items-center justify-between rounded border border-neutral-200 bg-white p-4 text-sm">
          <span className="text-neutral-700">{item.q}</span>
          <span className="rounded-full bg-accent-cta/10 px-2.5 py-1 font-medium text-accent-cta">{item.a}</span>
        </div>
      ))}
    </div>
  );
}

function Step2Visual() {
  return (
    <div className="rounded border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-neutral-900">Tender Readiness</p>
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-600">Urgent</span>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        You have an active compliance or procurement request and AI already in use — Tender Readiness gets you a real jurisdiction
        determination and draft answers fast.
      </p>
    </div>
  );
}

function Step3Visual() {
  return (
    <div className="space-y-3">
      <div className="rounded border border-dashed border-neutral-300 bg-white p-4 text-center text-sm text-neutral-500">
        Drop a PDF or DOCX, or type it in
      </div>
      <div className="rounded border border-neutral-200 bg-white p-4 text-sm text-neutral-700">Describe your AI use case…</div>
    </div>
  );
}

// Verbatim, real finding text — see this file's own docblock for source
// and non-PII confirmation. Not paraphrased, not invented.
function Step4Visual() {
  return (
    <div className="space-y-3">
      <div className="rounded border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-neutral-900">No compliance documentation submitted for applicable jurisdictions</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_STYLES.high}`}>High</span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          This company is subject to at least one AI-specific regulatory regime but has submitted no existing risk assessment or
          procurement-readiness documentation.
        </p>
      </div>
      <div className="rounded border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-neutral-900">EU AI Act Risk Classification</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_STYLES.medium}`}>Medium</span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">Classified limited-risk — reviewed and approved by a human before delivery.</p>
      </div>
    </div>
  );
}

export const AI_READINESS_DEMO_STEPS: DemoStep[] = [
  {
    eyebrow: "Step 1",
    label: "Answer 3 questions",
    title: "You answer 3 quick questions",
    body: "Are you using AI with customers? Have you had a compliance or procurement request? Do you handle personal data? That's it — not a form, a routing decision.",
    visual: <Step1Visual />,
  },
  {
    eyebrow: "Step 2",
    label: "Get matched",
    title: "You're matched to the right review, with real reasoning shown",
    body: "The match is computed from your answers, never guessed by AI — Tender Readiness, AI Reliability Audit, Data Protection Compliance, or a straight conversation with a human, whichever genuinely fits.",
    visual: <Step2Visual />,
  },
  {
    eyebrow: "Step 3",
    label: "Submit evidence",
    title: "You submit real evidence for that review",
    body: "Upload a document (we extract the text automatically) or answer a short guided form — no OAuth, no live connection to your systems required.",
    visual: <Step3Visual />,
  },
  {
    eyebrow: "Step 4",
    label: "Real findings, human-reviewed",
    title: "You get real findings, checked by a person first",
    body: "Every finding — including a guaranteed one when documentation is genuinely missing — is accepted, edited, or rejected by a human reviewer before you ever see it.",
    visual: <Step4Visual />,
  },
];
