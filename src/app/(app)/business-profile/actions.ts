"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Real Business Profile full field set (confirmed 2026-08-04, Priority 3)
 * — replaces the "only the one goal-linked field" stub. Session-scoped,
 * RLS-respecting client only, never admin — same discipline as everything
 * else built since real client auth landed.
 *
 * Writes a `company_profile_history` row per changed field (confirmed
 * design: "Profile edit history" is its own §5 checklist line, not
 * automatic from a trigger — this app has none) — only for fields that
 * actually changed, comparing against the values loaded when the form
 * rendered, not re-fetched here.
 */

export interface CompanyProfileFields {
  name: string;
  industry: string | null;
  businessModel: "B2B" | "B2C" | null;
  employeeCount: number | null;
  stage: string | null;
  websiteUrl: string | null;
  socialLinks: string[];
  revenueRangeBand: string | null;
  customerType: string | null;
  mainToolsStack: string[];
  teamStructureSummary: string | null;
}

export interface UpdateCompanyProfileResult {
  success: boolean;
  error?: string;
}

function fieldToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export async function updateCompanyProfile(
  companyId: string,
  previous: CompanyProfileFields,
  next: CompanyProfileFields,
): Promise<UpdateCompanyProfileResult> {
  const trimmedName = next.name.trim();
  if (!trimmedName) return { success: false, error: "Company name is required." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      name: trimmedName,
      industry: next.industry?.trim() || null,
      business_model: next.businessModel,
      employee_count: next.employeeCount,
      stage: next.stage?.trim() || null,
      website_url: next.websiteUrl?.trim() || null,
      social_links: { links: next.socialLinks },
      revenue_range_band: next.revenueRangeBand?.trim() || null,
      customer_type: next.customerType?.trim() || null,
      main_tools_stack: { tools: next.mainToolsStack },
      team_structure_summary: next.teamStructureSummary?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) return { success: false, error: `Couldn't save: ${error.message}` };

  const changedFields: { changed_field: string; old_value: string | null; new_value: string | null }[] = [];
  const compare: [string, keyof CompanyProfileFields][] = [
    ["name", "name"],
    ["industry", "industry"],
    ["business_model", "businessModel"],
    ["employee_count", "employeeCount"],
    ["stage", "stage"],
    ["website_url", "websiteUrl"],
    ["social_links", "socialLinks"],
    ["revenue_range_band", "revenueRangeBand"],
    ["customer_type", "customerType"],
    ["main_tools_stack", "mainToolsStack"],
    ["team_structure_summary", "teamStructureSummary"],
  ];
  for (const [dbField, key] of compare) {
    const oldStr = fieldToString(previous[key]);
    const newStr = fieldToString(next[key]);
    if (oldStr !== newStr) {
      changedFields.push({ changed_field: dbField, old_value: oldStr, new_value: newStr });
    }
  }

  if (changedFields.length > 0) {
    const { error: historyError } = await supabase
      .from("company_profile_history")
      .insert(changedFields.map((c) => ({ company_id: companyId, ...c })));
    if (historyError) return { success: false, error: `Saved, but failed to log history: ${historyError.message}` };
  }

  return { success: true };
}
