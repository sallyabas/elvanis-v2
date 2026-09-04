"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Real, inline "fix this now" path for Tender Readiness's and Data
 * Protection Compliance's own jurisdiction fields (confirmed 2026-09-04,
 * item 5) — closes a real gap: a client whose registration/customer-market
 * fields were genuinely never filled in previously only ever saw a passive
 * footnote linking out to Business Profile. This writes the same three
 * columns Business Profile's own updateCompanyProfile() writes, but scoped
 * narrowly to just these three fields for a client who arrived here
 * specifically to request a module and doesn't want to leave the page.
 * Session-scoped, ownership-checked exactly like every other Server Action
 * in this codebase — never the admin client.
 *
 * Deliberately does NOT also write company_profile_history — that's
 * Business Profile's own established "log every field change" behavior;
 * this is a narrower, single-purpose quick-fix action for a client
 * mid-module-intake, not a second copy of the full profile-editing flow.
 */
export async function updateJurisdictionQuickSetup(
  companyId: string,
  fields: { registrationCountry: string | null; uaeFreeZone: "mainland" | "difc" | "adgm" | null; customerMarketCountries: string[] },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase
    .from("companies")
    .update({
      registration_country: fields.registrationCountry?.trim() || null,
      uae_free_zone: fields.registrationCountry === "United Arab Emirates" ? fields.uaeFreeZone : null,
      customer_market_countries: fields.customerMarketCountries,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: `Couldn't save: ${error.message}` };
  return { success: true };
}
