import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import type { LensFinding, LensType } from "@/lib/lenses/types";

/**
 * Conflict Detection (spec §2.3 step 5): findings across lenses are checked
 * against each other for contradictions before prioritization. Flagged
 * conflicts are surfaced to the reviewer — see suggestedResolution below
 * for the one deliberate exception to "never resolves anything itself."
 *
 * Pure function: takes the flattened finding set from all 5 lenses, returns
 * detected conflicts. Persisting to `finding_conflicts` is the caller's job
 * (see src/lib/audit/run-audit.ts), same separation as the lenses themselves.
 */

export interface LensFindingWithSource {
  lens: LensType;
  finding: LensFinding;
}

export interface DetectedConflict {
  findingAId: string;
  findingBId: string;
  conflictDescription: string;
  /**
   * AI-suggested resolution (confirmed 2026-08-12, direct founder
   * request reversing this module's original "never resolves anything
   * itself" design) — the reviewer still has final say: accept it
   * as-is, edit it, or write their own from scratch. Same "AI drafts,
   * human decides" pattern as every finding in this app, applied to
   * conflicts for the first time. Nullable in the DB (older conflicts
   * predate this field) but always populated by this module going
   * forward — the LLM is required to propose one per conflict.
   */
  suggestedResolution: string;
}

const SYSTEM_PROMPT = `You are the Conflict Detection step of an AI execution audit. You read findings already drafted by five independent lenses (Financial, Commercial/Market, Execution/Operating, Product/Customer, AI & Governance) and identify GENUINE contradictions between them — cases where believing one finding logically undermines or conflicts with another, not just findings that happen to be topically related.

HARD RULES:
1. Only flag a GENUINE contradiction: two findings that imply mutually exclusive or inconsistent facts about the same business (e.g. Financial implies healthy margin while Execution implies severe, unaddressed cost drag; AI & Governance reports no live AI in production while another lens's evidence references an AI-powered customer feature). Findings that are merely related, or that reinforce/corroborate the same underlying situation from different angles, are NOT a conflict — do not flag those. Concrete example of a NON-conflict: "live AI in production with no governance documentation" and "no risk classification awareness" do not contradict each other — the second is an expected CONSEQUENCE of the first, not a competing claim. Only flag it if believing one finding would require disbelieving the other.
2. The findingAId and findingBId fields must be the EXACT "findingId" values from the list below — never invent one, never reference a finding that isn't in the list. These are for machine linking only.
3. conflictDescription is free text for a human reviewer — describe the two findings by their actual content (what each one says), in plain language. NEVER write a raw findingId inside conflictDescription — a reviewer cannot act on an ID string; describe what's contradictory using the findings' own substance instead.
4. Do NOT say which finding is "correct" inside conflictDescription — describe what's contradictory and why, full stop.
5. suggestedResolution IS your job, separately from rule 4 — for every conflict you flag, propose a concrete way to resolve it (e.g. "the Financial finding is based on a single month's data and is likely the outlier — confirm with the client before trusting the margin figure over the cost-drag finding" or "these may both be true if the drag is recent — ask the client whether the cost increase happened this quarter"). This is a genuine suggestion the reviewer can accept, edit, or override — write it as a real recommendation, not a hedge. Never reference a finding by ID here either — same rule 3 reasoning.
6. If there are no genuine conflicts, return an empty "conflicts" array — do not manufacture one just to have something to report.
7. Output strict JSON matching the schema below. No prose outside the JSON.

OUTPUT SCHEMA (JSON object):
{
  "conflicts": [
    { "findingAId": string, "findingBId": string, "conflictDescription": string, "suggestedResolution": string }
  ],
  "notes": string
}`;

const conflictSchema = z.object({
  findingAId: z.string(),
  findingBId: z.string(),
  conflictDescription: z.string(),
  suggestedResolution: z.string(),
});

const conflictDetectionOutputSchema = z.object({
  conflicts: z.array(conflictSchema),
  notes: z.string().optional(),
});

function formatFindingsForPrompt(findings: LensFindingWithSource[]): string {
  return findings
    .map(
      ({ lens, finding }) =>
        `[${finding.findingId}] (${lens}, confidence: ${finding.confidenceLevel}) ${finding.title} — ${finding.rootCause}`,
    )
    .join("\n");
}

export async function detectConflicts(findings: LensFindingWithSource[]): Promise<DetectedConflict[]> {
  if (findings.length < 2) return [];

  const validIds = new Set(findings.map((f) => f.finding.findingId));

  const raw = await generateValidatedJson(conflictDetectionOutputSchema, {
    schemaName: "conflict-detection",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `ALL FINDINGS FROM THIS AUDIT:\n${formatFindingsForPrompt(findings)}\n\nIdentify genuine conflicts now, following the output schema exactly.`,
      },
    ],
  });

  // Deterministic validation — the LLM can hallucinate an ID that doesn't
  // exist in the input set, same risk class as every other lens output.
  // Drop anything that doesn't reference two real, distinct findings.
  return raw.conflicts.filter(
    (c) => c.findingAId !== c.findingBId && validIds.has(c.findingAId) && validIds.has(c.findingBId),
  );
}
