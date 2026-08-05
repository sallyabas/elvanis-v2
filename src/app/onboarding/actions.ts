"use server";

import { createClient } from "@/lib/supabase/server";
import type { PrimaryGoal } from "@/lib/lenses/types";

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
 * Minimal field set, not the full Business Profile field set (that's
 * Priority 3, §5's separate "full field set" scope) — only what the core
 * lens engine's CompanyProfileForLens/GoalContext actually require
 * (company name, primary goal); everything else in those types is
 * nullable/optional and lenses already handle sparse profiles correctly
 * (tested extensively earlier this build).
 */
export async function createCompanyAndGoal(input: {
  companyName: string;
  primaryGoal: PrimaryGoal;
  urgencyLevel: string | null;
}): Promise<CreateCompanyResult> {
  const trimmedName = input.companyName.trim();
  if (!trimmedName) return { success: false, error: "Company name is required." };

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
    urgency_level: input.urgencyLevel,
  });
  if (goalError) return { success: false, error: `Couldn't save goal: ${goalError.message}` };

  return { success: true, companyId: company.id as string };
}
