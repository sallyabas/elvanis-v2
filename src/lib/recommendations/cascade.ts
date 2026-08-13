import type { LensType } from "@/lib/lenses/types";
import { matchRecommendationLibraryEntries, type IssueTypeKey, type RecommendationLibraryEntry } from "./recommendation-library";

/**
 * Signal cascades — the reasoning half (confirmed 2026-08-13, item 1 of the
 * old-Elvanis-inspired batch). recommendation-library.ts holds the curated
 * cascade MAP (`cascadesTo` per entry); this file turns that map plus a
 * real report's findings into a per-finding cascade signal a reviewer can
 * act on — "fixing this unlocks/is upstream of N other findings on this
 * report," extending `isFixFirstCandidate()` beyond severity + goal-
 * relevance alone (see prioritization.ts).
 *
 * Deterministic throughout, same discipline as every other cross-lens
 * judgment call in this codebase: a finding's "matched issue type" is
 * whichever library entry scores the most keyword overlap (the same
 * function already used for recommendation suggestions — never a second,
 * drifting matching implementation), and cascade counting is a plain set
 * intersection, never an LLM judgment.
 */
export interface FindingForCascade {
  id: string;
  lens: LensType;
  title: string;
  diagnosis: string;
}

export interface CascadeSignal {
  /** The best-matching issue type for this finding, or null when nothing in the library matched (a normal, expected result for many findings — this is a seed vocabulary, not exhaustive). */
  matchedIssueType: IssueTypeKey | null;
  /** How many OTHER findings on this report match an issue type this finding's own matched entry cascades to. */
  cascadeCount: number;
  /** Titles of those downstream findings, for a concrete "it's upstream of: X, Y" display — never just a bare number. */
  cascadesToFindingTitles: string[];
}

const EMPTY_SIGNAL: CascadeSignal = { matchedIssueType: null, cascadeCount: 0, cascadesToFindingTitles: [] };

/**
 * Computes a cascade signal for every finding in the given set, all
 * relative to each other — a finding's cascade count only ever counts
 * OTHER findings actually present in this same `findings` array (typically
 * one report's reviewer-approved/edited findings), never a hypothetical
 * global count. Cross-lens by design, matching the cascade map itself.
 */
export function computeCascadeSignals(findings: FindingForCascade[], library: RecommendationLibraryEntry[]): Map<string, CascadeSignal> {
  const matched = findings.map((finding) => {
    const topMatch = matchRecommendationLibraryEntries(library, finding.lens, finding.title, finding.diagnosis)[0];
    return { finding, matchedIssueType: topMatch?.key ?? null };
  });

  const result = new Map<string, CascadeSignal>();
  for (const { finding, matchedIssueType } of matched) {
    if (!matchedIssueType) {
      result.set(finding.id, EMPTY_SIGNAL);
      continue;
    }
    const entry = library.find((e) => e.key === matchedIssueType);
    const cascadesTo = new Set(entry?.cascadesTo ?? []);
    if (cascadesTo.size === 0) {
      result.set(finding.id, { matchedIssueType, cascadeCount: 0, cascadesToFindingTitles: [] });
      continue;
    }
    const downstream = matched.filter((m) => m.finding.id !== finding.id && m.matchedIssueType !== null && cascadesTo.has(m.matchedIssueType));
    result.set(finding.id, {
      matchedIssueType,
      cascadeCount: downstream.length,
      cascadesToFindingTitles: downstream.map((d) => d.finding.title),
    });
  }
  return result;
}
