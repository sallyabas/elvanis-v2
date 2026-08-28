"use server";

import { createClient } from "@/lib/supabase/server";
import { computePathBRouting, type PathBRoutingResult, type TriageAiUsage, type TriageComplianceRequest, type TriagePersonalData } from "@/lib/onboarding/path-b-routing";
import { requestSession } from "@/lib/service-layer/session-requests";
import type { CreateCompanyResult } from "./actions";

export interface PathBMinimalProfileInput {
  /** Present when resuming from the Hub (company already exists, entry_path='undecided'); absent for a fresh Path B pick. */
  existingCompanyId?: string;
  /** Required only when existingCompanyId is absent — the Hub-resumed case already has a name from createCompanyMinimal(). */
  companyName?: string;
  industry: string;
  employeeCount: number;
  registrationCountry: string;
  uaeFreeZone: "mainland" | "difc" | "adgm" | null;
  customerMarketCountries: string[];
}

/**
 * Path B's 5-field minimal profile (confirmed 2026-08-27, Onboarding
 * Architecture & Path Routing brief, Part 3/8a) — company name, industry,
 * employee count, registration jurisdiction, and customer market
 * countries, all as real queryable columns (the jurisdiction fields
 * already existed on `companies` since 2026-07-31; this is the first time
 * they're collected at onboarding time rather than only via Business
 * Profile later). Handles both the fresh-pick case (INSERT, entry_path=
 * 'ai_audit') and the Hub-resumed case (UPDATE an existing 'undecided'
 * company, entry_path flips to 'ai_audit' here).
 */
export async function submitPathBMinimalProfile(input: PathBMinimalProfileInput): Promise<CreateCompanyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const fields = {
    industry: input.industry.trim() || null,
    employee_count: input.employeeCount,
    registration_country: input.registrationCountry.trim() || null,
    uae_free_zone: input.registrationCountry === "United Arab Emirates" ? input.uaeFreeZone : null,
    customer_market_countries: input.customerMarketCountries,
    entry_path: "ai_audit" as const,
  };

  if (input.existingCompanyId) {
    const { data: company, error } = await supabase
      .from("companies")
      .update(fields)
      .eq("id", input.existingCompanyId)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error || !company) return { success: false, error: error?.message ?? "Company not found." };
    return { success: true, companyId: company.id as string };
  }

  const trimmedName = input.companyName?.trim();
  if (!trimmedName) return { success: false, error: "Company name is required." };

  const { data: company, error } = await supabase
    .from("companies")
    .insert({ user_id: user.id, name: trimmedName, ...fields })
    .select("id")
    .single();
  if (error) return { success: false, error: `Couldn't create company: ${error.message}` };
  return { success: true, companyId: company.id as string };
}

export interface SubmitTriageResult {
  success: boolean;
  error?: string;
  routing?: PathBRoutingResult;
}

/**
 * Path B's triage screen (confirmed 2026-08-27, Part 3, extended same day
 * with the founder's own third-question refinement) — stores all three
 * answers as dedicated columns (Part 8c) and returns the deterministic
 * routing recommendation (computePathBRouting — never LLM-judged) for the
 * client to render as a real "here's what we recommend, and why" screen,
 * rather than a silent forced redirect.
 */
export async function submitTriageAnswers(input: {
  companyId: string;
  aiUsage: TriageAiUsage;
  complianceRequest: TriageComplianceRequest;
  personalData: TriagePersonalData;
}): Promise<SubmitTriageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error } = await supabase
    .from("companies")
    .update({
      triage_ai_usage: input.aiUsage,
      triage_compliance_request: input.complianceRequest,
      triage_personal_data: input.personalData,
    })
    .eq("id", input.companyId)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error || !company) return { success: false, error: error?.message ?? "Company not found." };

  const routing = computePathBRouting(input.aiUsage, input.complianceRequest, input.personalData);
  return { success: true, routing };
}

/**
 * "Route to human consultation" (confirmed 2026-08-27, Part 3 refinement,
 * founder-confirmed decision 2) — a thin wrapper around the existing
 * requestSession() mechanism with the new compliance_consultation session
 * type, called directly from the Path B recommendation screen rather than
 * routing to a module intake page.
 */
export async function requestComplianceConsultation(companyId: string, urgent: boolean): Promise<{ success: boolean; error?: string }> {
  return requestSession(companyId, "compliance_consultation", null, urgent);
}
