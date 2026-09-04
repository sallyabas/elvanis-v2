import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";

/**
 * Reviewer-only, per-decision regulatory staleness warning (confirmed
 * 2026-09-03, direct founder request) — genuinely distinct from the
 * pre-existing "Regulatory content status" panel on /queue
 * (regulatory-content-review.ts): that panel answers "when should someone
 * eventually go re-check this law" against an admin-adjustable, currently
 * 180-day cadence; this answers "should a reviewer pause before approving
 * THIS SPECIFIC report/module request today," using its own real,
 * separate, admin-adjustable setting (`regulatory_staleness_warning_days`,
 * seeded 90 — confirmed distinct from the panel's own cadence, not
 * reusing it, since the founder's own example ("97 days ago") is well
 * under the panel's 180-day threshold).
 *
 * JURISDICTION_LABELS is the single shared source of truth for jurisdiction
 * display names — /queue's own "Regulatory content status" panel now
 * imports from here too, rather than keeping its own independent copy
 * (previously the only copy; extracted here so the two surfaces can't
 * drift on how a jurisdiction is labeled).
 */
export const JURISDICTION_LABELS: Record<string, string> = {
  eu_ai_act: "EU AI Act",
  uae_difc_reg10: "UAE DIFC Regulation 10",
  saudi_ai_governance: "Saudi AI governance (SDAIA)",
  uk_gdpr: "UK GDPR",
  eu_gdpr: "EU GDPR",
  saudi_pdpl: "Saudi PDPL",
  uae_pdpl: "UAE federal PDPL",
  adgm_dpr: "ADGM DPR 2021",
  difc_dpl: "DIFC Data Protection Law No. 5 of 2020",
};

/**
 * Maps a jurisdiction-applicability flag's camelCase key (as returned by
 * Tender Readiness's and Data Protection Compliance's own
 * computeJurisdictionApplicability() functions) to the snake_case
 * `regulatory_content_reviews.jurisdiction` key it corresponds to.
 * Deliberately omits `uaeAiCharterReference` — confirmed non-binding
 * reference content only (Tender Readiness's own jurisdiction.ts
 * docblock), never tracked as a real regulatory framework with its own
 * `regulatory_content_reviews` row, so there's nothing to check staleness
 * against for it.
 */
const APPLICABILITY_KEY_TO_JURISDICTION: Record<string, string> = {
  euAiAct: "eu_ai_act",
  uaeDifcReg10: "uae_difc_reg10",
  saudiAiGovernance: "saudi_ai_governance",
  ukGdpr: "uk_gdpr",
  euGdpr: "eu_gdpr",
  saudiPdpl: "saudi_pdpl",
  uaePdpl: "uae_pdpl",
  adgmDpr: "adgm_dpr",
  difcDpl: "difc_dpl",
};

export interface RegulatoryStalenessWarning {
  jurisdiction: string;
  label: string;
  daysSinceReview: number;
}

/**
 * `applicableKeys` — every applicability flag TRUE for this report/module
 * request (camelCase, e.g. ["euAiAct", "saudiPdpl"]) — caller's
 * responsibility to compute those first (see the two workspace pages for
 * how each does it; the two contexts genuinely differ — see this
 * function's own callers for that distinction, not repeated here).
 */
export async function computeStalenessWarnings(applicableKeys: string[]): Promise<RegulatoryStalenessWarning[]> {
  const thresholdDays = await getSettingNumber("regulatory_staleness_warning_days", 90);
  const jurisdictions = [...new Set(applicableKeys.map((k) => APPLICABILITY_KEY_TO_JURISDICTION[k]).filter((j): j is string => Boolean(j)))];
  if (jurisdictions.length === 0) return [];

  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("regulatory_content_reviews").select("jurisdiction, last_reviewed_at").in("jurisdiction", jurisdictions);
  if (error) throw new Error(`computeStalenessWarnings: failed to load review rows: ${error.message}`);

  const now = Date.now();
  return (rows ?? [])
    .map((r) => {
      const jurisdiction = r.jurisdiction as string;
      return {
        jurisdiction,
        label: JURISDICTION_LABELS[jurisdiction] ?? jurisdiction,
        daysSinceReview: Math.floor((now - new Date(r.last_reviewed_at as string).getTime()) / (24 * 60 * 60 * 1000)),
      };
    })
    .filter((r) => r.daysSinceReview >= thresholdDays)
    .sort((a, b) => b.daysSinceReview - a.daysSinceReview);
}
