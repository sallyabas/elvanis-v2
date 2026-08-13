import type { LensFinding } from "@/lib/lenses/types";
import { computeCascadeSignals, type FindingForCascade } from "@/lib/recommendations/cascade";
import type { RecommendationLibraryEntry } from "@/lib/recommendations/recommendation-library";

/**
 * Deterministic 30/60/90 roadmap, extracted here (confirmed 2026-08-04)
 * since the Dashboard needs the identical derivation the client Report
 * view already uses — a single shared function rather than two copies
 * that could drift. See the Report view's original docblock for why this
 * is deterministic rather than a new AI-generation feature: nothing else
 * in this codebase ever writes `reports.roadmap_30_60_90`, so this is
 * derived at render time from the report's own top-3 findings instead.
 *
 * Cascade reasoning (confirmed 2026-08-13, item 5 of the old-Elvanis-
 * inspired batch, depends on item 1's cascade map — see
 * recommendations/cascade.ts) — a real, disclosed design decision, not an
 * arbitrary implementation detail: the 30/60/90 BUCKET a finding lands in
 * still comes from severity alone, unchanged — severity is already defined
 * as "business impact if left unaddressed" (see Severity's own docblock in
 * lenses/types.ts), a genuinely different concept from cascade count, and
 * a critical finding still needs 30-day action regardless of how many
 * other findings it happens to cascade to. What cascade reasoning DOES
 * change: within each bucket, findings that are upstream of other real
 * findings on the report sort first, and carry a real "fixing this first
 * unlocks N other findings" annotation — the roadmap now surfaces WHICH
 * finding in a tied bucket is worth tackling first, not just WHEN.
 */
export interface RoadmapItem {
  finding: LensFinding;
  cascadeCount: number;
  cascadesToFindingTitles: string[];
}

export interface Roadmap {
  day30: RoadmapItem[];
  day60: RoadmapItem[];
  day90: RoadmapItem[];
}

/**
 * A top-3 finding paired with its real `lens_findings.id` DB row id.
 * Deliberately NOT `LensFinding.findingId` — a real, pre-existing bug found
 * while building this (confirmed 2026-08-13): `run-audit.ts` re-tags each
 * finding's `findingId` with the real DB UUID only IN-MEMORY, for that
 * one function call (conflict detection, default top-3 selection) — it is
 * never written back into the persisted `ai_draft` jsonb column. Every
 * page that later reads a finding back out of the DB gets the LLM's own
 * stale, draft-scoped `findingId` on `ai_draft.findingId`, not the real row
 * id. This was harmless everywhere it was only ever used as a React list
 * key (collisions are unlikely in practice), but cascade lookup needs the
 * REAL id to match `allReportFindings`'s ids, so callers must supply it
 * explicitly here rather than trust the finding's own `findingId` field.
 * The deeper fix (persisting the real id back into `ai_draft`, or backfilling
 * historical rows) is a separate, larger, disclosed follow-on — not done as
 * a side effect of this roadmap change.
 */
export interface Top3FindingWithId {
  id: string;
  finding: LensFinding;
}

export function deriveRoadmap(top3: Top3FindingWithId[], allReportFindings: FindingForCascade[], recommendationLibrary: RecommendationLibraryEntry[]): Roadmap {
  const cascadeSignals = computeCascadeSignals(allReportFindings, recommendationLibrary);

  function toItem({ id, finding }: Top3FindingWithId): RoadmapItem {
    const signal = cascadeSignals.get(id);
    return { finding, cascadeCount: signal?.cascadeCount ?? 0, cascadesToFindingTitles: signal?.cascadesToFindingTitles ?? [] };
  }

  function bucket(items: Top3FindingWithId[]): RoadmapItem[] {
    return items.map(toItem).sort((a, b) => b.cascadeCount - a.cascadeCount);
  }

  return {
    day30: bucket(top3.filter((t) => t.finding.severity === "critical" || t.finding.severity === "high")),
    day60: bucket(top3.filter((t) => t.finding.severity === "medium")),
    day90: bucket(top3.filter((t) => t.finding.severity === "low")),
  };
}
