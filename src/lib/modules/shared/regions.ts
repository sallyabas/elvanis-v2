/**
 * Country/region name sets shared across jurisdiction-applicability logic
 * (Tender Readiness, Data Protection Compliance). Extracted so the EU
 * member-state list — the one piece of data both modules must agree on —
 * can't silently drift into two different lists over time.
 */

export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

// EU member states as of 2026 — names as they're likely to appear in
// customer_market_countries. Deliberately excludes the UK (not in the EU)
// and non-EU EEA members (Norway/Iceland/Liechtenstein) unless/until
// confirmed the relevant regulation extends to them the same way
// GDPR-adjacent EEA rules sometimes do — treat as EU-only until verified
// otherwise.
export const EU_MEMBER_STATES = new Set(
  [
    "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "czech republic",
    "denmark", "estonia", "finland", "france", "germany", "greece", "hungary",
    "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands",
    "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
  ].map(normalize),
);

export const UK_NAMES = new Set(["uk", "united kingdom", "great britain"].map(normalize));
export const SAUDI_ARABIA_NAMES = new Set(["saudi arabia", "ksa", "kingdom of saudi arabia"].map(normalize));
export const UAE_NAMES = new Set(["uae", "united arab emirates"].map(normalize));

/**
 * True if `country` (any casing/whitespace) falls within a jurisdiction
 * this codebase has real, built regulatory logic for (UK/EU/Saudi
 * Arabia/UAE) — confirmed 2026-09-04, "jurisdiction not covered" warning.
 * Distinct from a country genuinely having zero applicable regulations
 * (e.g. a UK-registered company with only US customers: US customers are
 * a known-but-inapplicable market, not an unknown one) — this only
 * answers "does this app have ANY logic at all for this country," which
 * both Tender Readiness and Data Protection Compliance's own applicability
 * computations already implicitly assume true for every country they're
 * ever given, without ever checking or disclosing when it isn't.
 */
export function isKnownJurisdictionCountry(country: string): boolean {
  const normalized = normalize(country);
  return UK_NAMES.has(normalized) || EU_MEMBER_STATES.has(normalized) || SAUDI_ARABIA_NAMES.has(normalized) || UAE_NAMES.has(normalized);
}
