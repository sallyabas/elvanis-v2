import { SEVERITY_STYLES } from "@/lib/severity-badge";

/**
 * Styled product mockups for the landing page's Problem/Solution sections
 * (confirmed 2026-09-02, layout redesign) — the same honest resolution
 * already established for the interactive demo's own "real findings"
 * step: this session's browser tooling has no way to export a literal
 * raster screenshot to disk (confirmed by directly searching for a
 * persisted image file after capturing a test screenshot — nothing
 * exists outside the chat transcript). Per explicit instruction, these
 * are real, honest placeholders matching the product's real visual
 * language — verbatim real copy (PathBWizard's own real triage-screen
 * heading/questions, Nimbus Ledger Ltd's own real, already-delivered
 * finding text) and the real SEVERITY_STYLES classes the app itself
 * uses — laid out and sized exactly where a literal screenshot would
 * go, so one can be dropped in later with zero layout change. Not a
 * generic illustration: every word and every color decision here is
 * real, just not a photographed pixel capture.
 */

/**
 * Path B triage screen (confirmed 2026-09-02) — verbatim heading/subhead
 * from PathBWizard.tsx's own real triage screen, and the same 3
 * real questions/answers already used in AiReadinessDemoSteps.tsx's
 * Step1Visual. Styled as a "browser chrome" card so it reads as a real
 * app screen, not a floating text block.
 */
export function TriageScreenMockup() {
  const items = [
    { q: "Using AI with customers?", a: "Yes" },
    { q: "Recent compliance or procurement request?", a: "Yes" },
    { q: "Handle personal data?", a: "Not sure" },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card-2">
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="ml-3 truncate text-xs text-neutral-400">app.elvanis.com/ai-audit</span>
      </div>
      <div className="p-6 sm:p-8">
        <h4 className="text-lg font-semibold text-neutral-900">A couple of quick questions</h4>
        <p className="mt-1 text-sm text-neutral-500">These decide what happens next — not more profile fields.</p>
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div key={item.q} className="flex items-center justify-between gap-3 rounded-md border border-accent bg-[#fffbf0] px-4 py-3 text-sm">
              <span className="text-neutral-800">{item.q}</span>
              <span className="shrink-0 rounded-full bg-accent-cta/10 px-2.5 py-1 text-xs font-semibold text-accent-cta">{item.a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A real finding card (confirmed 2026-09-02) — verbatim real finding
 * text from an actual, already-delivered Tender Readiness report
 * (Nimbus Ledger Ltd, disposable non-PII test data, request
 * `0e46e5dd-1596-468d-988e-2bcd1fb000ac`), already used as real,
 * verified content in AiReadinessDemoSteps.tsx's own Step4Visual. Reused
 * here rather than a second, differently-worded example — one real
 * source of truth for "what a real finding looks like."
 */
export function FindingCardMockup() {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card-1">
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        <span className="ml-2 truncate text-[11px] text-neutral-400">app.elvanis.com/reports/…</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-semibold text-neutral-900">No compliance documentation submitted for applicable jurisdictions</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_STYLES.high}`}>High</span>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          This company is subject to at least one AI-specific regulatory regime but has submitted no existing risk assessment or
          procurement-readiness documentation.
        </p>
      </div>
    </div>
  );
}
