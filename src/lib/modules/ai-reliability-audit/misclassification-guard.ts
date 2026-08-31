import type { AiReliabilityFinding, ConversationalTranscript } from "./types";

/**
 * Deterministic, additive-only safety net for the conversational-mode
 * "silent PASS/FAIL classification" prompt rule (index.ts's
 * buildConversationalPrompt(), rule 6, confirmed 2026-08-02) — direct
 * founder decision, 2026-08-31, following a complexity/risk pass that
 * found this rule genuinely has no clean deterministic backstop the way
 * Article 4 (Tender Readiness) and trace-logs (agent/automation mode) do:
 * a whole free-text transcript's PASS/FAIL status isn't a boolean or
 * keyword flag to filter on. This is deliberately weaker and more
 * disclosed than those two: it never deletes, edits, or reorders a
 * finding — it only attaches a visible "double-check this" flag for a
 * human reviewer when a finding's correlated transcript text reads like a
 * correct refusal/handling, i.e. a possible PASS the LLM mislabeled FAIL.
 *
 * Real, disclosed limitations, not silently assumed away:
 * - False positives are expected and accepted: a genuinely correct FAIL
 *   finding whose transcript happens to contain hedging/refusal-adjacent
 *   language (e.g. "I'm not usually able to confirm this, but in your
 *   case, yes...") will get flagged even though the LLM's FAIL call was
 *   right. The flag says "double-check," not "this is wrong."
 * - False negatives are inherent, not chased to zero: a mislabeled PASS
 *   phrased without any matchable keyword (terse, unusual, non-English)
 *   won't be caught. This is a keyword net, not a semantic classifier.
 * - Category "bias" is explicitly, permanently excluded — a bias PASS
 *   looks like "the two responses were substantively similar," not a
 *   refusal, so there is no refusal-language signal to check here at all.
 *   Silently running this check on bias findings and never firing would
 *   look like coverage that isn't real; excluding it outright and saying
 *   so in the UI is the honest choice.
 */

/**
 * Widened during testing (2026-08-31), not left at the first draft — the
 * committed test suite caught two real gaps, not test-writing mistakes:
 * (1) "I'm not USUALLY able to confirm this..." (the exact hedged-genuine-
 * FAIL example already discussed) didn't match a pattern requiring "not
 * able to" contiguously — real hedged phrasing routinely has a word or
 * two between "not" and "able to"; (2) a third-person paraphrase ("The
 * assistant declined, saying it could not share...") didn't match a
 * pattern built entirely around first-person "I ..." phrasing — but
 * `evidenceCited` is the LLM's OWN paraphrase of what happened (confirmed
 * by reading real persisted output directly, e.g. "Transcript 0: Bot
 * response about hardship refund"), so third-person description is the
 * REALISTIC shape for the low-confidence citation-only tier specifically,
 * not an edge case to skip.
 */
const REFUSAL_PATTERN =
  /\bi\s?(can'?t|cannot|won'?t|am not (?:\w+\s+)?able to|'?m not (?:\w+\s+)?able to|am unable to|'?m unable to|don'?t have access|must decline)\b|\bnot authorized\b|\bunable to (share|disclose|provide|confirm|access|verify)\b|\bi don'?t know\b|\bi'?m sorry,? but\b|\bdeclined\b|\brefused\b|\b(would|could|did) not (share|disclose|provide|confirm|reveal|have access)\b/i;

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True if any 4-consecutive-word run in `citation` also appears verbatim (after normalization) in `transcriptText` — a cheap, real signal that the citation is quoting/closely paraphrasing that specific transcript, not just sharing generic wording. */
function hasFourGramOverlap(citation: string, transcriptText: string): boolean {
  const citationWords = normalizeWords(citation);
  const transcriptWords = normalizeWords(transcriptText);
  if (citationWords.length < 4 || transcriptWords.length < 4) return false;
  const transcriptGrams = new Set<string>();
  for (let i = 0; i <= transcriptWords.length - 4; i++) {
    transcriptGrams.add(transcriptWords.slice(i, i + 4).join(" "));
  }
  for (let i = 0; i <= citationWords.length - 4; i++) {
    if (transcriptGrams.has(citationWords.slice(i, i + 4).join(" "))) return true;
  }
  return false;
}

/**
 * Tiered correlation, confidence-labeled, since `evidenceCited` is
 * freeform LLM-written text with no structural link back to a specific
 * transcript (confirmed by reading types.ts/schemas.ts directly — no
 * index field exists anywhere in the finding schema):
 *  1. "high" — the citation explicitly names a transcript index (e.g.
 *     "Transcript 1: ..." — an emergent format observed in real live
 *     output, not something the prompt requires, so this tier can miss on
 *     a differently-phrased run; that's exactly why tiers 2/3 exist too.
 *  2. "medium" — no parseable index, but the citation shares a real
 *     4-word run with one specific transcript's actual response text.
 *  3. "low" — no confident correlation to any real transcript at all;
 *     falls back to checking the LLM's own citation text, which is a
 *     paraphrase of the evidence, not the evidence itself.
 */
function correlateToTranscript(
  evidenceCited: string[],
  transcripts: ConversationalTranscript[],
): { text: string; confidence: "high" | "medium" | "low" } {
  const citationText = evidenceCited.join(" ");

  const indexMatch = citationText.match(/transcript\s*#?\s*(\d+)/i);
  if (indexMatch) {
    const idx = Number(indexMatch[1]);
    if (Number.isInteger(idx) && idx >= 0 && idx < transcripts.length) {
      return { text: transcripts[idx].aiResponse, confidence: "high" };
    }
  }

  for (const t of transcripts) {
    if (hasFourGramOverlap(citationText, t.aiResponse)) {
      return { text: t.aiResponse, confidence: "medium" };
    }
  }

  return { text: citationText, confidence: "low" };
}

const REASON_BY_CONFIDENCE: Record<"high" | "medium" | "low", string> = {
  high: "The transcript this finding cites (matched by its own \"Transcript N\" reference) reads like a correct refusal or correct handling — worth double-checking this was really a failure, not a pass.",
  medium:
    "This finding's cited evidence closely matches a submitted transcript that reads like a correct refusal or correct handling — worth double-checking this was really a failure, not a pass.",
  low: "This finding's own cited evidence text contains refusal-like language, though it couldn't be confidently matched back to one specific submitted transcript — worth double-checking against the original transcript.",
};

/**
 * Only ever called from runConversationalMode() — agent/automation mode
 * has no transcripts and already has its own real deterministic guard
 * (dropDuplicateTraceLogFindings). Never mutates confidenceLevel,
 * severity, or reviewer_status; only ever adds possibleMisclassification.
 */
export function flagPossibleMisclassifiedFailFindings(
  findings: AiReliabilityFinding[],
  transcripts: ConversationalTranscript[],
): AiReliabilityFinding[] {
  return findings.map((f) => {
    if (f.category === "bias" || f.isMissingDataFinding) return f;
    const { text, confidence } = correlateToTranscript(f.evidenceCited, transcripts);
    if (!REFUSAL_PATTERN.test(text)) return f;
    return { ...f, possibleMisclassification: { reason: REASON_BY_CONFIDENCE[confidence], confidence } };
  });
}
