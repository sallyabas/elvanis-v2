"use server";

import { createClient } from "@/lib/supabase/server";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { validateDesiredFutureState } from "@/lib/goals/validation";
import { findMetricDefinition } from "@/lib/lenses/metric-direction";
import { setUserNameIfUnset } from "@/lib/users/set-name";

export interface CreateCompanyResult {
  success: boolean;
  companyId?: string;
  error?: string;
}

function validateGoalFields(input: {
  primaryGoal: PrimaryGoal;
  secondaryGoal: PrimaryGoal | null;
  targetMetric: string | null;
  successDefinition: string | null;
  targetMetricKey: string | null;
  targetMetricValue: number | null;
}): string | null {
  if (input.secondaryGoal && input.secondaryGoal === input.primaryGoal) {
    return "Secondary goal must be different from the primary goal.";
  }
  const targetMetricCheck = validateDesiredFutureState(input.targetMetric ?? "");
  if (!targetMetricCheck.valid) return `Target metric: ${targetMetricCheck.error}`;
  const successDefinitionCheck = validateDesiredFutureState(input.successDefinition ?? "");
  if (!successDefinitionCheck.valid) return `Success definition: ${successDefinitionCheck.error}`;
  if (input.targetMetricKey && input.targetMetricValue === null) return "Enter a target value for the metric you selected.";
  if (input.targetMetricValue !== null && !input.targetMetricKey) return "Select which metric that target value is for.";
  if (input.targetMetricKey && !findMetricDefinition(input.targetMetricKey)) return "Unrecognized target metric.";
  return null;
}

/**
 * Real, session-scoped company + goal creation (confirmed 2026-08-03,
 * Priority 1) — uses the session's own RLS-respecting client
 * (src/lib/supabase/server.ts), never the admin/service-role client.
 * `user_id` is taken from the session server-side, never trusted from
 * client input.
 *
 * Extended 2026-08-27 (Onboarding Architecture & Path Routing brief,
 * Part 2/8b) — `industry`/`employeeCount` (Path A's minimal-profile
 * fields, previously only collectible later via Business Profile) and
 * `entryPath` (always "diagnosis" for this function — the fresh-creation
 * entry point for Path A) are now written in the same insert. This
 * function is deliberately still the FRESH-creation path only (no
 * existing company); the Path-B-fork case where a company already exists
 * and just needs a goal attached is `addGoalToExistingCompany()` below.
 */
export async function createCompanyAndGoal(input: {
  companyName: string;
  yourName?: string | null;
  industry: string | null;
  employeeCount: number | null;
  primaryGoal: PrimaryGoal;
  secondaryGoal: PrimaryGoal | null;
  urgencyLevel: string | null;
  targetMetric: string | null;
  targetMetricKey: string | null;
  targetMetricValue: number | null;
  timeHorizon: string | null;
  successDefinition: string | null;
}): Promise<CreateCompanyResult> {
  const trimmedName = input.companyName.trim();
  if (!trimmedName) return { success: false, error: "Company name is required." };

  const goalError = validateGoalFields(input);
  if (goalError) return { success: false, error: goalError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      user_id: user.id,
      name: trimmedName,
      industry: input.industry?.trim() || null,
      employee_count: input.employeeCount,
      entry_path: "diagnosis",
    })
    .select("id")
    .single();
  if (companyError) return { success: false, error: `Couldn't create company: ${companyError.message}` };

  const { error: insertGoalError } = await supabase.from("goals").insert({
    company_id: company.id,
    primary_goal: input.primaryGoal,
    secondary_goal: input.secondaryGoal,
    urgency_level: input.urgencyLevel,
    target_metric: input.targetMetric,
    target_metric_key: input.targetMetricKey,
    target_metric_value: input.targetMetricValue,
    time_horizon: input.timeHorizon,
    success_definition: input.successDefinition,
  });
  if (insertGoalError) return { success: false, error: `Couldn't save goal: ${insertGoalError.message}` };

  if (input.yourName) await setUserNameIfUnset(supabase, user.id, input.yourName);

  return { success: true, companyId: company.id as string };
}

/**
 * Minimal, name-only company creation (confirmed 2026-08-27, Part 1) —
 * used exactly once: when a brand-new signup picks "I'm not sure yet" on
 * the entry-path routing screen. `companies.name` is `not null`, so even
 * the "undecided" branch needs the one unavoidable field before a company
 * row can exist at all; entry_path is stamped `undecided` here (a real,
 * distinct, persisted choice — not the same as "the routing screen hasn't
 * been answered yet," which is a company that doesn't exist yet). The
 * Hub screen that follows collects nothing else — per Part 4, "the hub
 * page does not collect any data."
 */
export async function createCompanyMinimal(input: { companyName: string }): Promise<CreateCompanyResult> {
  const trimmedName = input.companyName.trim();
  if (!trimmedName) return { success: false, error: "Company name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ user_id: user.id, name: trimmedName, entry_path: "undecided" })
    .select("id")
    .single();
  if (companyError) return { success: false, error: `Couldn't create company: ${companyError.message}` };

  return { success: true, companyId: company.id as string };
}

/**
 * Attaches a real goal to a company that already exists — confirmed
 * 2026-08-27, Part 1/3, two real callers:
 * 1. Path B's "No/exploring" AI-usage triage branch — the founder's own
 *    confirmed decision: this fork is honestly "Path A, entered via Path
 *    B," reusing this exact goal-selection step rather than a new one.
 *    The company already exists (created at Path B's 5-field minimal-
 *    profile step, entry_path='ai_audit') — this call both inserts the
 *    goal AND flips entry_path to 'diagnosis', since the client is now
 *    getting the real diagnosis-shaped experience (Business Health lead
 *    section), not an AI-audit one.
 * 2. Resuming "Business Diagnosis" from the Hub screen when the company
 *    already exists with entry_path='undecided' (created by
 *    createCompanyMinimal() above) — `industry`/`employeeCount` are
 *    accepted here too so the still-missing minimal-profile fields get
 *    collected in the same round trip, rather than a separate action.
 *
 * Session-scoped, ownership verified via the `.eq("user_id", user.id)`
 * filter on the update — never trusts the caller's companyId alone.
 */
export async function addGoalToExistingCompany(input: {
  companyId: string;
  industry?: string | null;
  employeeCount?: number | null;
  primaryGoal: PrimaryGoal;
  secondaryGoal: PrimaryGoal | null;
  urgencyLevel: string | null;
  targetMetric: string | null;
  targetMetricKey: string | null;
  targetMetricValue: number | null;
  timeHorizon: string | null;
  successDefinition: string | null;
}): Promise<CreateCompanyResult> {
  const goalError = validateGoalFields(input);
  if (goalError) return { success: false, error: goalError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const update: Record<string, unknown> = { entry_path: "diagnosis" };
  if (input.industry !== undefined) update.industry = input.industry?.trim() || null;
  if (input.employeeCount !== undefined) update.employee_count = input.employeeCount;

  const { data: company, error: updateError } = await supabase
    .from("companies")
    .update(update)
    .eq("id", input.companyId)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (updateError || !company) return { success: false, error: updateError?.message ?? "Company not found." };

  const { error: insertGoalError } = await supabase.from("goals").insert({
    company_id: input.companyId,
    primary_goal: input.primaryGoal,
    secondary_goal: input.secondaryGoal,
    urgency_level: input.urgencyLevel,
    target_metric: input.targetMetric,
    target_metric_key: input.targetMetricKey,
    target_metric_value: input.targetMetricValue,
    time_horizon: input.timeHorizon,
    success_definition: input.successDefinition,
  });
  if (insertGoalError) return { success: false, error: `Couldn't save goal: ${insertGoalError.message}` };

  return { success: true, companyId: input.companyId };
}

/**
 * Change (or set) the company's entry_path directly — confirmed
 * 2026-08-27, Part 1 ("can be changed later from Account Settings").
 * Deliberately does NOT touch anything else — changing this never
 * retroactively alters delivered reports, since reports/module_requests
 * carry no reference to entry_path at all. Session-scoped, ownership
 * verified.
 */
export async function chooseEntryPath(companyId: string, entryPath: "diagnosis" | "ai_audit" | "undecided"): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase.from("companies").update({ entry_path: entryPath }).eq("id", companyId).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
