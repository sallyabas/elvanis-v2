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
  /** Added 2026-08-05 (query-quality improvement, see docblock below) — sharpens the broader scan beyond generic industry terms. */
  customerType: string | null;
}

const MAX_RESULTS_PER_TARGETED_SEARCH = 3;
const MAX_RESULTS_PER_BROADER_QUERY = 3;

/**
 * Search-query quality improvement (confirmed 2026-08-05, pulled forward
 * from V2 "Better Commercial/Market lens") — closes a real, previously
 * flagged gap: "The broader-scan query is somewhat generic right now and
 * sometimes surfaces generic marketing-blog content rather than genuine
 * competitive intel" (see CLAUDE.md, flagged during the original 2026-07-31
 * verification, not fixed at the time).
 *
 * Two changes, both about query specificity, not volume:
 * 1. The single generic "new competitors and market changes in X" broader
 *    scan is now two more targeted queries — one aimed at competitive
 *    moves among established players (pricing/funding/positioning), one
 *    aimed specifically at new entrants — since a single broad query tends
 *    to average out to generic SEO content that satisfies neither intent
 *    well.
 * 2. `customerType` (SMB/Enterprise/etc, already on CompanyProfileForLens)
 *    is now woven into query context alongside industry/businessModel,
 *    since "competitors in fintech SaaS" and "competitors in enterprise
 *    fintech SaaS" surface meaningfully different, more relevant results.
 *
 * Deliberately NOT changed: this remains real-time web search per audit,
 * not a static "competitive benchmark library" (e.g. typical price-premium
 * tolerance by industry) — that specific V2 item is explicitly marked
 * "needs real cases" in the spec doc and stays deferred; building a
 * fabricated version now would violate the standing rule against guessing
 * at data-dependent features.
 */
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

  // Broader independent scan, split into two more targeted angles rather
  // than one generic query — catches what the client might not know about.
  const industryContext = input.industry ?? "B2B SaaS";
  const segmentContext = [input.businessModel, input.customerType].filter((v): v is string => !!v).join(" ");
  const contextSuffix = segmentContext ? ` for ${segmentContext} companies` : "";

  const competitiveMovesResult = await search({
    query: `recent pricing, funding, or positioning changes among ${industryContext} competitors${contextSuffix}`,
    maxResults: MAX_RESULTS_PER_BROADER_QUERY,
  });
  for (const item of competitiveMovesResult.results) {
    findings.push({ topic: item.title, summary: item.content, sourceUrls: [item.url], targetedCompetitor: null });
  }

  const newEntrantsResult = await search({
    query: `new entrants or emerging competitors in ${industryContext}${contextSuffix}`,
    maxResults: MAX_RESULTS_PER_BROADER_QUERY,
  });
  for (const item of newEntrantsResult.results) {
    findings.push({ topic: item.title, summary: item.content, sourceUrls: [item.url], targetedCompetitor: null });
  }

  return findings;
}

/**
 * Auto-trigger wrapper (confirmed 2026-08-13, direct founder request) —
 * runCompetitorResearch() itself was fully built and tested since
 * 2026-07-31 but never actually had a caller in application code; both
 * real audit-execution paths (run-pending-audits.ts, rerun-audit.ts)
 * hardcoded `independentResearch: []` instead. This wrapper is what those
 * two callers now use. Deliberately defensive — research is enrichment on
 * top of the client's own self-report, not a hard requirement for the
 * Commercial lens to run at all (it already handles an empty
 * independentResearch array correctly, per its own prompt rules), so a
 * transient Tavily failure here must never fail the whole 5-lens audit
 * the way an uncaught throw would (runAuditForClaimedSubmission's own
 * catch block would otherwise mark the entire submission for stale-retry
 * over what's really just a research-enrichment hiccup).
 */
export async function runCompetitorResearchSafely(input: CompetitorResearchInput): Promise<IndependentResearchFinding[]> {
  try {
    return await runCompetitorResearch(input);
  } catch {
    return [];
  }
}
