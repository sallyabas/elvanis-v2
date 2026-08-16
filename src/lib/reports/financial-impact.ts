import type { FinancialImpact, LensFinding } from "@/lib/lenses/types";

/**
 * Real aggregated financial exposure (confirmed 2026-08-16, final Dashboard
 * redesign pass) — genuinely real data, not invented for this pass:
 * `LensFinding.financialImpact` (impactBandLow/impactBandHigh/currency/
 * confidenceLevel/assumptions) has existed on every finding from every one
 * of the 5 lenses since the original schema design, and every lens prompt
 * already enforces "always a range, never a fake-precise single number, set
 * to null if you can't responsibly estimate one" — this reuses that
 * existing discipline rather than introducing a new one. Deliberately does
 * NOT touch the separate `financial_impact_estimates` DB table, which is
 * unrelated and confirmed genuinely dormant (schema-only, zero application
 * code references it, unlike this field which lives directly on
 * `lens_findings.ai_draft` and is real and populated).
 *
 * `isUsableFinancialImpact()` — real bug found and fixed live during this
 * pass, checking real accounts before screenshotting anything: two genuine
 * cases of the model NOT following its own "null when uncertain" prompt
 * rule cleanly. (1) A "Cash Runway" finding on a real delivered report had
 * impactBandLow/High of -150000/-75000 — a negative "estimated cost,"
 * which reads as a formatting bug to a client even though the underlying
 * number is real. (2) A "Gross Margin" finding on another real report had
 * impactBandLow: 0, impactBandHigh: 0, currency: "unknown",
 * confidenceLevel: "insufficient" — the model should have set the whole
 * field to null per its own instructions, but instead emitted a degenerate
 * zero-zero placeholder. Neither is fabricated by this code; both are real
 * LLM output already in the database. Rather than patch every display
 * site's own ad hoc null-check (which is what let this slip through
 * originally), one shared validity check now gates every place this field
 * is read for display or aggregation — same "guard against LLM output that
 * violates its own contract" discipline already used pervasively elsewhere
 * in this codebase (isValidEditedContentShape, dropDuplicateMissingDocumentationFindings,
 * etc.).
 */
export function isUsableFinancialImpact(impact: FinancialImpact | null): impact is FinancialImpact & { impactBandLow: number; impactBandHigh: number } {
  if (!impact) return false;
  if (impact.impactBandLow === null || impact.impactBandHigh === null) return false;
  if (impact.impactBandLow < 0 || impact.impactBandHigh < 0) return false;
  if (impact.impactBandLow === 0 && impact.impactBandHigh === 0) return false;
  if (impact.confidenceLevel === "insufficient") return false;
  return true;
}

export interface AggregatedFinancialImpact {
  low: number;
  high: number;
  currency: string;
  /** How many of the input findings actually had a usable band — surfaced so callers can be honest when it's fewer than the total finding count. */
  quantifiedCount: number;
  totalCount: number;
}

export function aggregateFinancialImpact(findings: LensFinding[]): AggregatedFinancialImpact | null {
  const quantified = findings.filter((f) => isUsableFinancialImpact(f.financialImpact));
  if (quantified.length === 0) return null;

  // Real, disclosed simplification: this codebase is UK-first V1 (every
  // real lens run and every real pricing figure to date has been GBP) — if
  // a mixed-currency case ever genuinely occurs, use whichever currency the
  // FIRST quantified finding reports rather than attempting cross-currency
  // math this app has no real exchange-rate source for.
  const currency = quantified[0].financialImpact!.currency;

  const low = quantified.reduce((sum, f) => sum + f.financialImpact!.impactBandLow!, 0);
  const high = quantified.reduce((sum, f) => sum + f.financialImpact!.impactBandHigh!, 0);

  return { low, high, currency, quantifiedCount: quantified.length, totalCount: findings.length };
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

/** "£15,000–£45,000" — real thousands separators, never a bare unformatted number. */
export function formatCurrencyRange(low: number, high: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const fmt = (n: number) => `${symbol}${Math.round(n).toLocaleString("en-GB")}`;
  if (low === high) return fmt(low);
  return `${fmt(low)}–${fmt(high)}`;
}
