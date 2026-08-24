/**
 * Resolves a report's real, reviewer-ranked Top 3 from
 * `reports.top_3_finding_ids` (confirmed 2026-08-20, real data-consistency
 * bug found and fixed) — one shared implementation for every consumer
 * (Dashboard, the client Report page, /demo-live), replacing three
 * independent copies of the same buggy pattern: filtering the
 * visible-findings list by Set membership in `top_3_finding_ids`. That
 * pattern had two real problems: (a) it discarded the reviewer's actual
 * ranked order — the result was whatever arbitrary order the DB query
 * happened to return, not rank 1/2/3 — and (b) it was never capped at 3,
 * so a report whose `top_3_finding_ids` array had grown past 3
 * (`reRankTop3()` in reviewer/workspace.ts only checks non-empty, not
 * <= 3 — a real, separate, still-open gap in that function, not fixed
 * here) rendered every one of them under a "Top 3" label.
 *
 * Fixed by mapping `top_3_finding_ids` in ITS OWN stored order first, then
 * capping to 3 — this restores the reviewer's real ranking and keeps
 * every "Top 3" surface across the app honest and mutually consistent,
 * regardless of how the underlying array got longer than 3 or what order
 * a given query returned rows in.
 */
export function resolveTop3FindingsInOrder<T extends { id: string }>(top3FindingIds: string[], visibleFindings: T[]): T[] {
  const byId = new Map(visibleFindings.map((f) => [f.id, f]));
  return top3FindingIds
    .map((id) => byId.get(id))
    .filter((f): f is T => !!f)
    .slice(0, 3);
}
