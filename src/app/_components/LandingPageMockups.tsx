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
 * Step1Visual.
 *
 * Re-cropped 2026-09-02 (direct founder fix): the original version wrapped
 * this in a simulated "browser chrome" bar (traffic-light dots + a fake
 * address bar) so it read as a real app screen rather than a floating
 * text block. Founder feedback was explicit — no browser/OS chrome at
 * all, product UI only, cropped tight to the card content — so that bar
 * is removed entirely; the card's own real border + shadow now does the
 * "this is a real screen" work on its own, matching how a literal tight
 * screenshot crop would actually look.
 */
export function TriageScreenMockup() {
  const items = [
    { q: "Using AI with customers?", a: "Yes" },
    { q: "Recent compliance or procurement request?", a: "Yes" },
    { q: "Handle personal data?", a: "Not sure" },
  ];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-card-2 sm:p-8">
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
  );
}

/**
 * Two real finding cards (confirmed 2026-09-02), extended from a single
 * card per direct founder feedback — one finding on its own understated
 * the real product ("multiple specific findings delivered, not just
 * one"). Both are verbatim real finding text from the same actual,
 * already-delivered Tender Readiness report (Nimbus Ledger Ltd,
 * disposable non-PII test data, request
 * `0e46e5dd-1596-468d-988e-2bcd1fb000ac`) — the second is the identical
 * real "EU AI Act Risk Classification" finding already used in
 * AiReadinessDemoSteps.tsx's own Step4Visual, reused rather than a third,
 * differently-worded example. Kept inside one browser-chrome frame
 * (stacked findings on one real report screen), not two separate
 * "windows" — that chrome bar wasn't part of the founder's crop feedback
 * (which was scoped to the Section 1 triage screenshot specifically), so
 * it's left as-is here.
 */
export function FindingCardMockup() {
  const findings = [
    {
      title: "No compliance documentation submitted for applicable jurisdictions",
      severity: "high" as const,
      body: "This company is subject to at least one AI-specific regulatory regime but has submitted no existing risk assessment or procurement-readiness documentation.",
    },
    {
      title: "EU AI Act Risk Classification",
      severity: "medium" as const,
      body: "Classified limited-risk — reviewed and approved by a human before delivery.",
    },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card-1">
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        <span className="ml-2 truncate text-[11px] text-neutral-400">app.elvanis.com/reports/…</span>
      </div>
      <div className="divide-y divide-neutral-100">
        {findings.map((f) => (
          <div key={f.title} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold text-neutral-900">{f.title}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_STYLES[f.severity]}`}>
                {f.severity === "high" ? "High" : "Medium"}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
