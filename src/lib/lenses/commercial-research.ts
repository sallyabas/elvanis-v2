import { search } from "@/lib/search-client";

/**
 * The "system runs its own research" half of Commercial/Market's hybrid
 * design (confirmed 2026-07-31, see CLAUDE.md): targeted searches on the
 * competitors the client named (bounded — one query per named competitor,
 * not open-ended crawling), plus a broader independent scan to catch what
 * the client might not know about.
 *
 * Real implementation, not a mock — built on src/lib/search-client (Tavily).
 * Every returned finding's sourceUrls come directly from the search
 * provider's response; nothing here is LLM-generated. commercial.ts's own
 * synthesis prompt separately enforces that it must never invent an
 * "ai_independent" finding beyond what's returned here — that's the
 * anti-fabrication line: search results may only ever be summarized by the
 * provider or passed through verbatim, never "recalled" by the LLM as if it
 * were live research.
 */

export interface IndependentResearchFinding {
  topic: string;
  summary: string;
  sourceUrls: string[];
  /** Which client-named competitor this was a targeted search about; null if from the broader scan. */
  targetedCompetitor: string | null;
}

export interface CompetitorResearchInput {
  namedCompetitors: string[];
  industry: string | null;
  businessModel: "B2B" | "B2C" | null;
}

const MAX_RESULTS_PER_TARGETED_SEARCH = 3;
const MAX_RESULTS_FOR_BROADER_SCAN = 5;

export async function runCompetitorResearch(input: CompetitorResearchInput): Promise<IndependentResearchFinding[]> {
  const findings: IndependentResearchFinding[] = [];

  // Targeted searches — one per client-named competitor, bounded by name.
  for (const competitor of input.namedCompetitors) {
    const result = await search({
      query: `${competitor} pricing changes product updates news`,
      maxResults: MAX_RESULTS_PER_TARGETED_SEARCH,
    });

    for (const item of result.results) {
      findings.push({
        topic: item.title,
        summary: item.content,
        sourceUrls: [item.url],
        targetedCompetitor: competitor,
      });
    }
  }

  // Broader independent scan — not tied to a named competitor, catches
  // what the client might not know about (new entrants, market shifts).
  const industryContext = input.industry ?? "B2B SaaS";
  const broaderResult = await search({
    query: `new competitors and market changes in ${industryContext}${input.businessModel ? ` (${input.businessModel})` : ""}`,
    maxResults: MAX_RESULTS_FOR_BROADER_SCAN,
  });

  for (const item of broaderResult.results) {
    findings.push({
      topic: item.title,
      summary: item.content,
      sourceUrls: [item.url],
      targetedCompetitor: null,
    });
  }

  return findings;
}
