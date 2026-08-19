import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import { formatGoalContextForPrompt } from "@/lib/lenses/goals";
import type { CompanyProfileForLens, GoalContext, LensFinding } from "@/lib/lenses/types";

/**
 * AI-drafted task breakdown for an Execution Sprint (confirmed 2026-08-06)
 * — a bounded 2-4 week paid implementation engagement to fix ONE specific
 * finding from an approved audit, not an ongoing PM tool or dev sprint.
 * Same "LLM drafts, reviewer approves" discipline as every other AI
 * surface in this app: this module only proposes; the reviewer's
 * Accept/Edit/Reject pass (see workspace.ts) is the mandatory gate before
 * a client ever sees a task.
 */

const draftedTaskSchema = z.object({
  taskDescription: z.string(),
  /** A role/title, never a real person's name — the client fills in an actual name later, matching the confirmed "simple free-text label" design. */
  ownerRoleLabel: z.string(),
  kpiDescription: z.string(),
  kpiTargetValue: z.number(),
  /** Real, dedicated unit field (confirmed 2026-08-19) — a short label for what kpiTargetValue is measured in (e.g. "%", "days", "prospects", "£"), shown directly next to the client-facing "Actual" input. Distinct from kpiDescription, which is the fuller sentence describing what's being measured. */
  kpiUnit: z.string(),
  kpiDirection: z.enum(["higher_is_better", "lower_is_better"]),
  /** Relative to the sprint's start date — must fit the 2-4 week (14-28 day) window. */
  suggestedDueDaysFromStart: z.number().int().min(1).max(28),
});

const draftOutputSchema = z.object({
  tasks: z.array(draftedTaskSchema).min(3).max(8),
});

export type DraftedSprintTask = z.infer<typeof draftedTaskSchema>;

const SYSTEM_PROMPT = `You are drafting the task breakdown for a paid Execution Sprint — a bounded 2-4 week implementation engagement to fix ONE specific finding from a client's execution audit. This is NOT an ongoing project-management relationship, NOT an Agile dev sprint backlog, and NOT an embedded-CPO engagement — it is a defined, time-boxed deliverable scoped tightly around the one finding provided.

HARD RULES — violating any of these makes your output unusable:
1. Every task must be grounded in the finding's actual diagnosis/rootCause/recommendedAction below — never invent work unrelated to what was actually found. The recommendedAction is your strongest signal for what the tasks should actually be.
2. Produce between 3 and 8 tasks total — a lightweight, concrete plan for a bounded 2-4 week window, not an exhaustive project plan with every conceivable sub-step.
3. "ownerRoleLabel" is a role/title (e.g. "Developer", "PM", "Finance Lead", "Ops Lead") — never a specific person's real name. The client will confirm or type an actual name later.
4. Each task needs one genuinely measurable KPI: a plain-language description of what's being measured, a numeric target, the unit that number is measured in, and whether higher or lower is better for that metric. If the finding's evidence doesn't support a precise number, use a reasonable, clearly-scoped estimate rather than a fake-precise one — but it must still be a real number, not a vague qualitative claim.
5. "kpiUnit" is a short label for what "kpiTargetValue" is measured in — e.g. "%", "days", "hours", "£", "prospects", "tickets/week". Keep it short (a symbol or one or two words), never a repeat of the full kpiDescription sentence.
6. "suggestedDueDaysFromStart" must fit within the 2-4 week (14-28 day) engagement window — never schedule a task beyond day 28, and sequence tasks sensibly (earlier groundwork before later validation steps).
7. Output strict JSON matching the schema below. No prose outside the JSON.

OUTPUT SCHEMA (JSON object):
{
  "tasks": [
    {
      "taskDescription": string,
      "ownerRoleLabel": string,
      "kpiDescription": string,
      "kpiTargetValue": number,
      "kpiUnit": string,
      "kpiDirection": "higher_is_better" | "lower_is_better",
      "suggestedDueDaysFromStart": number
    }
  ]
}`;

function buildUserPrompt(finding: LensFinding, company: CompanyProfileForLens, goal: GoalContext): string {
  return `SELECTED FINDING TO FIX (the entire scope of this sprint):
Title: ${finding.title}
Diagnosis: ${finding.diagnosis}
Root cause: ${finding.rootCause}
Recommended action: ${finding.recommendedAction}
Severity: ${finding.severity}

COMPANY PROFILE:
Name: ${company.name}
Industry: ${company.industry ?? "unknown"}
Business model: ${company.businessModel ?? "unknown"}
Employee count: ${company.employeeCount ?? "unknown"}
Stage: ${company.stage ?? "unknown"}
Team structure: ${company.teamStructureSummary ?? "unknown"}

GOAL CONTEXT:
${formatGoalContextForPrompt(goal)}

Draft the task breakdown now, following the output schema exactly.`;
}

export async function draftSprintTasks(
  finding: LensFinding,
  company: CompanyProfileForLens,
  goal: GoalContext,
): Promise<DraftedSprintTask[]> {
  const raw = await generateValidatedJson(draftOutputSchema, {
    schemaName: "execution-sprint-task-draft",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(finding, company, goal) },
    ],
  });
  return raw.tasks;
}
