import { createTestAdminClient } from "./db";

/**
 * Directly writes a company's `triage_*` columns — confirmed 2026-09-02.
 * Used by the Path B spec to exercise branches 2-4 of the deterministic
 * routing computation (`computePathBRouting()`) without re-running a full
 * real signup + UI radio-click sequence per branch: `/ai-audit` (per its
 * own docblock) recomputes and renders the recommendation directly from
 * these columns on every load, regardless of how they were set — so this
 * is a legitimate way to exercise all 4 combinations against the real
 * rendering code, not a shortcut around it. Branch 1 in the spec still
 * goes through the real triage UI once, proving the actual radio-click
 * path works; branches 2-4 prove the same rendering/computation logic
 * for the other real answer combinations.
 */
export async function setCompanyTriage(
  companyId: string,
  aiUsage: "customer_facing" | "internal_only" | "exploring" | "not_sure",
  complianceRequest: "active_request" | "want_ahead" | "not_applicable",
  personalData: "yes" | "no" | "not_sure",
): Promise<void> {
  const supabase = createTestAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ triage_ai_usage: aiUsage, triage_compliance_request: complianceRequest, triage_personal_data: personalData })
    .eq("id", companyId);
  if (error) throw new Error(`setCompanyTriage failed: ${error.message}`);
}

export async function getCompanyIdByName(name: string): Promise<string> {
  const supabase = createTestAdminClient();
  const { data, error } = await supabase.from("companies").select("id").eq("name", name).single();
  if (error || !data) throw new Error(`getCompanyIdByName(${name}) failed: ${error?.message}`);
  return data.id as string;
}
