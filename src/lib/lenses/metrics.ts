// Typed, unit-explicit metric evidence — the deterministic alternative to
// letting the LLM do benchmark arithmetic itself. See CLAUDE.md: Execution
// lens testing found the model calling 96 hours "slower than industry
// average" against a 105.6-hour benchmark (96 < 105.6, so actually faster) —
// a prompt-only "show your work" fix made the error auditable but did not
// reliably fix the model's own conclusion (wrong direction in 2 of 3 runs).
// The fix: the comparison itself (>, <, tier lookup) happens in code here,
// never in the prompt. The LLM only narrates the implications of a result
// that's already computed and guaranteed correct.

/** A single named, unit-explicit numeric input to a lens. */
export interface MetricInput {
  metricKey: string;
  value: number;
}

/**
 * The output of a code-side benchmark comparison — handed to the LLM as an
 * already-decided fact. `comparisonText` is the exact sentence the model
 * must use verbatim; it must never recompute or restate the comparison in
 * its own words.
 */
export interface ComputedMetricComparison {
  metricKey: string;
  label: string;
  value: number;
  unit: string;
  tier: string;
  comparisonText: string;
}

export function formatComputedComparisonsForPrompt(comparisons: ComputedMetricComparison[]): string {
  if (comparisons.length === 0) {
    return "(no metrics matched a known benchmark — discuss any numbers in the evidence qualitatively, but do not assert a specific benchmark tier/comparison for them)";
  }

  return comparisons
    .map((c) => `- [${c.metricKey}] ${c.label}: ${c.value} ${c.unit} — ${c.comparisonText} (tier: ${c.tier})`)
    .join("\n");
}
