"use server";

import { createClient } from "@/lib/supabase/server";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { validateDesiredFutureState } from "@/lib/goals/validation";

export interface CreateCompanyResult {
  success: boolean;
  companyId?: string;
  error?: string;
}

/**
 * Real, session-scoped company + goal creation (confirmed 2026-08-03,
 * Priority 1) — uses the session's own RLS-respecting client
 * (src/lib/supabase/server.ts), never the admin/service-role client. That
 * was the entire point of building real client auth: this is the first
 * place a client account writes its own data, and it must go through the
 * same protection every other client-owned row gets, not an admin
 * shortcut. `user_id` is taken from the session server-side, never trusted
 * from client input.
 *
 * Field set extended 2026-08-05 (Goal definition wizard, pulled forward
 * from V2) — the `goals` table has always had `secondary_goal`/
 * `target_metric`/`time_horizon`/`success_definition` columns (see the
 * original schema migration), but no UI ever captured them; only
 * `primary_goal`/`urgency_level` were ever written. Still deliberately not
 * the full Business Profile field set (company-level fields stay
 * Priority 3's job) — this is specifically about fully using the
 * `GoalContext` shape every lens already reads, not expanding company
 * fields. `desiredFutureStatePrimary`/`Secondary` stay out of this form on
 * purpose — that's business-profile's own dedicated, already-built capture
 * mechanism (spec §1.9a: "one capture mechanism only"), not duplicated here.
 */
export async function createCompanyAndGoal(input: {
  companyName: string;
  primaryGoal: PrimaryGoal;
  secondaryGoal: PrimaryGoal | null;
  urgencyLevel: string | null;
  targetMetric: string | null;
  timeHorizon: string | null;
  successDefinition: string | null;
}): Promise<CreateCompanyResult> {
  const trimmedName = input.companyName.trim();
  if (!trimmedName) return { success: false, error: "Company name is required." };

  if (input.secondaryGoal && input.secondaryGoal === input.primaryGoal) {
    return { success: false, error: "Secondary goal must be different from the primary goal." };
  }

  // Reuses the same deliberately-basic length + degenerate-input check
  // already built for desired-future-state (spec §1.9a) — generic text
  // validation, not field-specific despite the function's name, and never
  // an AI judgment of answer quality here either.
  const targetMetricCheck = validateDesiredFutureState(input.targetMetric ?? "");
  if (!targetMetricCheck.valid) return { success: false, error: `Target metric: ${targetMetricCheck.error}` };
  const successDefinitionCheck = validateDesiredFutureState(input.successDefinition ?? "");
  if (!successDefinitionCheck.valid) return { success: false, error: `Success definition: ${successDefinitionCheck.error}` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ user_id: user.id, name: trimmedName })
    .select("id")
    .single();
  if (companyError) return { success: false, error: `Couldn't create company: ${companyError.message}` };

  const { error: goalError } = await supabase.from("goals").insert({
    company_id: company.id,
    primary_goal: input.primaryGoal,
    secondary_goal: input.secondaryGoal,
    urgency_level: input.urgencyLevel,
    target_metric: input.targetMetric,
    time_horizon: input.timeHorizon,
    success_definition: input.successDefinition,
  });
  if (goalError) return { success: false, error: `Couldn't save goal: ${goalError.message}` };

  return { success: true, companyId: company.id as string };
}
