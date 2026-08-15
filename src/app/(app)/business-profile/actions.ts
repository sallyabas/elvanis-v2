"use server";

import { createClient } from "@/lib/supabase/server";
import { runDigitalPresenceCheck, type DigitalPresenceResult } from "@/lib/digital-presence/check";

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
  /**
   * Real gap found and closed 2026-08-15 (module intake/service flow
   * review) — registration_country/uae_free_zone/customer_market_countries
   * have existed on `companies` since the original schema (the exact
   * fields Tender Readiness's and Data Protection Compliance's
   * jurisdiction-applicability logic depend on) but were NEVER
   * client-settable anywhere in the app — no form ever wrote to them.
   * Confirmed live against a real request: a company with all three
   * genuinely null/empty correctly computed zero applicable jurisdictions
   * (the deterministic logic itself was never the bug), but there was no
   * way for that client to ever provide the data in the first place. This
   * closes that, not just the display of its absence.
   */
  registrationCountry: string | null;
  uaeFreeZone: "mainland" | "difc" | "adgm" | null;
  customerMarketCountries: string[];
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
      registration_country: next.registrationCountry?.trim() || null,
      uae_free_zone: next.registrationCountry === "United Arab Emirates" ? next.uaeFreeZone : null,
      customer_market_countries: next.customerMarketCountries,
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
    ["registration_country", "registrationCountry"],
    ["uae_free_zone", "uaeFreeZone"],
    ["customer_market_countries", "customerMarketCountries"],
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

export interface RunDigitalPresenceCheckResult {
  success: boolean;
  result?: DigitalPresenceResult;
  error?: string;
}

/**
 * Digital Presence check (confirmed 2026-08-14, item 7) — real-time,
 * on-demand, never persisted (see check.ts's own docblock for why not).
 * Session-scoped ownership check first, same discipline as every other
 * Server Action in this codebase, even though the actual work (a fetch to
 * the client's own already-public website) doesn't touch any DB row.
 */
export async function runDigitalPresenceCheckAction(companyId: string): Promise<RunDigitalPresenceCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error } = await supabase.from("companies").select("id, website_url").eq("id", companyId).eq("user_id", user.id).maybeSingle();
  if (error || !company) return { success: false, error: "Company not found, or you don't have access to it." };
  if (!company.website_url) return { success: false, error: "Add a website URL to Business Profile first." };

  const result = await runDigitalPresenceCheck(company.website_url as string);
  return { success: true, result };
}
