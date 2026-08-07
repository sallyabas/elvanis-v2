/**
 * Live demo config — confirmed 2026-08-07, replacing the earlier
 * timer-compressed mock simulation at /demo (which stays untouched and
 * still linked from the landing page's "interactive demo" section — this
 * is an additive rebuild, not a replacement, per explicit direction).
 *
 * Points at ONE fixed, real, already-delivered report from an existing
 * seeded test company — Riverbank Analytics Ltd, the same company used
 * throughout the Execution Sprint Dashboard and Evidence-library
 * verification passes this session (report f3356934-...). Chosen over the
 * other real candidates (Nimbus Ledger Ltd's 412f1ed2/d7c28f88, Nimbus
 * Ledger Test Co's ad52b4f3) specifically because it's the one company
 * with a real, active Execution Sprint attached — the richest single
 * example of the actual product surface (dashboard tile, full report,
 * evidence library, sprint progress), not just the one with the most raw
 * findings.
 *
 * Deliberately a single hardcoded ID, not a route parameter — this is
 * the whole point: /demo-live has no dynamic segment, so there is no
 * enumeration surface exposing any OTHER company's real report data.
 * Read-only, no forms, no write actions anywhere on the page.
 */
export const DEMO_LIVE_COMPANY_ID = "feeae9f6-4c04-49a7-8d27-fb205a56a8ca";
export const DEMO_LIVE_REPORT_ID = "f3356934-9e52-460c-bd4b-b2f02594634d";
