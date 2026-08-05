import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import type { LensFinding, LensType } from "@/lib/lenses/types";

/**
 * Conflict Detection (spec §2.3 step 5): findings across lenses are checked
 * against each other for contradictions before prioritization. Flagged
 * conflicts are surfaced to the reviewer, never silently resolved by the AI
 * — this module only detects and describes, it never picks a winner.
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
}

const SYSTEM_PROMPT = `You are the Conflict Detection step of an AI execution audit. You read findings already drafted by five independent lenses (Financial, Commercial/Market, Execution/Operating, Product/Customer, AI & Governance) and identify GENUINE contradictions between them — cases where believing one finding logically undermines or conflicts with another, not just findings that happen to be topically related.

HARD RULES:
1. Only flag a GENUINE contradiction: two findings that imply mutually exclusive or inconsistent facts about the same business (e.g. Financial implies healthy margin while Execution implies severe, unaddressed cost drag; AI & Governance reports no live AI in production while another lens's evidence references an AI-powered customer feature). Findings that are merely related, or that reinforce the same conclusion from different angles, are NOT a conflict — do not flag those.
2. Cite the EXACT "findingId" values from the list below — never invent an ID, never reference a finding that isn't in the list.
3. Do NOT resolve the conflict yourself and do NOT say which finding is "correct" — describe what's contradictory and why, full stop. Resolution is the human reviewer's job, not yours.
4. If there are no genuine conflicts, return an empty "conflicts" array — do not manufacture one just to have something to report.
5. Output strict JSON matching the schema below. No prose outside the JSON.

OUTPUT SCHEMA (JSON object):
{
  "conflicts": [
    { "findingAId": string, "findingBId": string, "conflictDescription": string }
  ],
  "notes": string
}`;

const conflictSchema = z.object({
  findingAId: z.string(),
  findingBId: z.string(),
  conflictDescription: z.string(),
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
