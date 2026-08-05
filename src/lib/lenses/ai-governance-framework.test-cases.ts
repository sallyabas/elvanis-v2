/**
 * Committed test-case suite for scoreDimension/computeOverallMaturity
 * (confirmed 2026-08-06, ahead of migrating GOVERNANCE_DIMENSIONS + the
 * overall-maturity tier boundaries to the DB — treated as a close cousin
 * of the lens benchmarks, same requirement). Same precedent as
 * jurisdiction.test-cases.ts. Tests the pure functions directly against
 * DEFAULT_GOVERNANCE_DIMENSIONS / DEFAULT_GOVERNANCE_MATURITY_TIER_BOUNDARIES
 * — no DB dependency. Run with:
 *   npx tsx --env-file=.env.local src/lib/lenses/ai-governance-framework.test-cases.ts
 */
import {
  computeOverallMaturity,
  DEFAULT_GOVERNANCE_DIMENSIONS,
  DEFAULT_GOVERNANCE_MATURITY_TIER_BOUNDARIES,
  scoreDimension,
  type ComputedDimensionScore,
  type OverallMaturityTier,
} from "./ai-governance-framework";

function main() {
  let failures = 0;

  // ── scoreDimension: clamping + level-description lookup ──────────────
  interface ScoreCase {
    name: string;
    key: string;
    rawScore: number;
    expectedClamped: number;
  }
  const scoreCases: ScoreCase[] = [
    { name: "negative score clamps to 0", key: "ai_use_inventory", rawScore: -1, expectedClamped: 0 },
    { name: "score 0 stays 0", key: "ai_use_inventory", rawScore: 0, expectedClamped: 0 },
    { name: "score 1.4 rounds down to 1", key: "human_oversight", rawScore: 1.4, expectedClamped: 1 },
    { name: "score 1.5 rounds up to 2", key: "human_oversight", rawScore: 1.5, expectedClamped: 2 },
    { name: "score 3 stays 3", key: "governance_ownership", rawScore: 3, expectedClamped: 3 },
    { name: "score above 3 clamps to 3", key: "governance_ownership", rawScore: 5, expectedClamped: 3 },
  ];

  for (const c of scoreCases) {
    const result = scoreDimension(DEFAULT_GOVERNANCE_DIMENSIONS, c.key as never, c.rawScore);
    if (result === null) {
      failures++;
      console.log(`FAIL — ${c.name}: got null`);
      continue;
    }
    const def = DEFAULT_GOVERNANCE_DIMENSIONS.find((d) => d.key === c.key)!;
    const levelOk = result.score === c.expectedClamped && result.levelDescription === def.levels[c.expectedClamped];
    console.log(levelOk ? `PASS — ${c.name}` : `FAIL — ${c.name}: expected score ${c.expectedClamped}, got ${result.score}`);
    if (!levelOk) failures++;
  }

  const unrecognizedKey = scoreDimension(DEFAULT_GOVERNANCE_DIMENSIONS, "not_a_real_dimension" as never, 2);
  const unrecognizedOk = unrecognizedKey === null;
  console.log(unrecognizedOk ? "PASS — unrecognized dimension key returns null" : "FAIL — unrecognized dimension key did not return null");
  if (!unrecognizedOk) failures++;

  // ── computeOverallMaturity: tier boundaries ───────────────────────────
  // 7 dimensions × max 3 = 21 max possible with DEFAULT_GOVERNANCE_DIMENSIONS.
  // Boundaries: nascent <=6, developing <=13, established <=18, mature >18.
  function fixtureScores(total: number): ComputedDimensionScore[] {
    // Distribute `total` across the 7 dimensions (0-3 each) — exact
    // distribution doesn't matter, only the sum computeOverallMaturity reads.
    const scores: ComputedDimensionScore[] = [];
    let remaining = total;
    for (const def of DEFAULT_GOVERNANCE_DIMENSIONS) {
      const s = Math.max(0, Math.min(3, remaining));
      remaining -= s;
      scores.push({ key: def.key, label: def.label, score: s, levelDescription: def.levels[s], source: def.source });
    }
    return scores;
  }

  interface MaturityCase {
    name: string;
    totalScore: number;
    expectedTier: OverallMaturityTier;
  }
  const maturityCases: MaturityCase[] = [
    { name: "total 0 -> nascent", totalScore: 0, expectedTier: "nascent" },
    { name: "total 6 (boundary) -> nascent", totalScore: 6, expectedTier: "nascent" },
    { name: "total 7 -> developing, not nascent", totalScore: 7, expectedTier: "developing" },
    { name: "total 13 (boundary) -> developing", totalScore: 13, expectedTier: "developing" },
    { name: "total 14 -> established, not developing", totalScore: 14, expectedTier: "established" },
    { name: "total 18 (boundary) -> established", totalScore: 18, expectedTier: "established" },
    { name: "total 19 -> mature, not established", totalScore: 19, expectedTier: "mature" },
    { name: "total 21 (max possible) -> mature", totalScore: 21, expectedTier: "mature" },
  ];

  for (const c of maturityCases) {
    const result = computeOverallMaturity(DEFAULT_GOVERNANCE_DIMENSIONS, fixtureScores(c.totalScore), DEFAULT_GOVERNANCE_MATURITY_TIER_BOUNDARIES);
    const ok = result.tier === c.expectedTier && result.totalScore === c.totalScore && result.maxPossible === 21;
    console.log(ok ? `PASS — ${c.name}` : `FAIL — ${c.name}: expected tier "${c.expectedTier}" total ${c.totalScore}/21, got tier "${result.tier}" total ${result.totalScore}/${result.maxPossible}`);
    if (!ok) failures++;
  }

  const total = scoreCases.length + 1 + maturityCases.length;
  console.log(`\n${total - failures}/${total} passed.`);
  if (failures > 0) process.exit(1);
}

main();
