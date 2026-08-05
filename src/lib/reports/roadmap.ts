import type { LensFinding } from "@/lib/lenses/types";

/**
 * Deterministic 30/60/90 roadmap, extracted here (confirmed 2026-08-04)
 * since the Dashboard needs the identical derivation the client Report
 * view already uses — a single shared function rather than two copies
 * that could drift. See the Report view's original docblock for why this
 * is deterministic rather than a new AI-generation feature: nothing else
 * in this codebase ever writes `reports.roadmap_30_60_90`, so this is
 * derived at render time from the report's own top-3 findings instead.
 */
export interface Roadmap {
  day30: LensFinding[];
  day60: LensFinding[];
  day90: LensFinding[];
}

export function deriveRoadmap(top3: LensFinding[]): Roadmap {
  return {
    day30: top3.filter((f) => f.severity === "critical" || f.severity === "high"),
    day60: top3.filter((f) => f.severity === "medium"),
    day90: top3.filter((f) => f.severity === "low"),
  };
}
