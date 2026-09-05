import { createAdminClient } from "@/lib/supabase/admin";
import { computeStatus } from "@/lib/reviewer/regulatory-frameworks";

/**
 * Reviewer-only, per-decision regulatory staleness warning — migrated
 * 2026-09-05 to read from regulatory_frameworks (see that module's own
 * docblock for the full migration reasoning) instead of the old
 * regulatory_content_reviews + its own separate regulatory_staleness_warning_days
 * app_settings value. Genuinely distinct from the "Regulatory Framework
 * Tracker" admin page (regulatory_frameworks.ts's listRegulatoryFrameworks()):
 * that page answers "when should someone eventually go re-check this
 * law"; this answers "should a reviewer pause before approving THIS
 * SPECIFIC report/module request today" — using each framework's own
 * real staleness_threshold_days directly, not a separate global setting.
 *
 * Real upgrade bundled into this migration, not left at the old single-
 * tier warning (confirmed 2026-09-05, matching the original brief's own
 * component 3): now returns a genuine RED (overdue)/AMBER (within 14 days
 * of threshold) two-tier result, using regulatory_frameworks.ts's own
 * computeStatus() — the exact same function the admin page and the cron
 * check use, so all three can never silently disagree about what's
 * overdue vs. upcoming.
 *
 * JURISDICTION_LABELS is the single shared source of truth for jurisdiction
 * display names — /admin/regulatory-frameworks and the reviewer-workspace
 * banners all read from here rather than keeping independent copies.
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
  article_4_ai_literacy: "Article 4 AI Literacy",
};

/**
 * Maps a jurisdiction-applicability flag's camelCase key (as returned by
 * Tender Readiness's and Data Protection Compliance's own
 * computeJurisdictionApplicability() functions) to the real
 * `regulatory_frameworks.short_code` value(s) it corresponds to — a real
 * one-to-many mapping for euAiAct specifically, since EU AI Act Article 4
 * (its own separately-tracked framework, confirmed 2026-09-05) applies
 * whenever the parent Act applies (see tender-readiness/index.ts's own
 * `article4Guaranteed = applicability.euAiAct && ...` — there is no
 * separate "article4" applicability flag, it's a sub-rule of euAiAct).
 * Deliberately omits `uaeAiCharterReference` — confirmed non-binding
 * reference content only, never tracked as a real regulatory framework.
 */
const APPLICABILITY_KEY_TO_SHORT_CODES: Record<string, string[]> = {
  euAiAct: ["eu_ai_act", "article_4_ai_literacy"],
  uaeDifcReg10: ["uae_difc_reg10"],
  saudiAiGovernance: ["saudi_ai_governance"],
  ukGdpr: ["uk_gdpr"],
  euGdpr: ["eu_gdpr"],
  saudiPdpl: ["saudi_pdpl"],
  uaePdpl: ["uae_pdpl"],
  adgmDpr: ["adgm_dpr"],
  difcDpl: ["difc_dpl"],
};

export interface RegulatoryStalenessWarning {
  shortCode: string;
  label: string;
  daysSinceReview: number | null;
  /** Never "green" — computeStalenessWarnings() only ever returns red/amber rows, since a green framework has nothing worth surfacing mid-decision. */
  status: "red" | "amber";
}

export interface RegulatoryFrameworkMetadata {
  shortCode: string;
  label: string;
  daysSinceReview: number | null;
  status: "red" | "amber" | "green";
}

/**
 * Real gap closed (confirmed 2026-09-05, found while doing final live
 * verification of the whole migration, not from a re-read of the original
 * brief text — that document was never saved as a file, per its own
 * "build brief, not a doc to store" instruction). The original brief's
 * "report metadata showing frameworks + last-reviewed date" is its own,
 * always-shown requirement, genuinely distinct from the RED/AMBER warning
 * banner above — `computeStalenessWarnings()`'s own docblock deliberately
 * drops fully-current ("green") frameworks, since a warning banner has
 * nothing useful to say about one; but that means a request whose
 * frameworks are ALL current showed no framework metadata anywhere on
 * this page at all, which is a real, silent scope reduction relative to
 * what was asked for, not a deliberate re-confirmed decision. This
 * function is the real fix: same resolution logic, but returns every
 * applicable framework's real review status, "green" included.
 */
export async function listApplicableFrameworksMetadata(applicableKeys: string[]): Promise<RegulatoryFrameworkMetadata[]> {
  const shortCodes = [...new Set(applicableKeys.flatMap((k) => APPLICABILITY_KEY_TO_SHORT_CODES[k] ?? []))];
  if (shortCodes.length === 0) return [];

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("regulatory_frameworks")
    .select("short_code, last_reviewed_at, staleness_threshold_days")
    .in("short_code", shortCodes);
  if (error) throw new Error(`listApplicableFrameworksMetadata: failed to load framework rows: ${error.message}`);

  return (rows ?? [])
    .map((r) => {
      const shortCode = r.short_code as string;
      const { daysSinceReview, status } = computeStatus({
        lastReviewedAt: r.last_reviewed_at as string | null,
        stalenessThresholdDays: r.staleness_threshold_days as number,
      });
      return { shortCode, label: JURISDICTION_LABELS[shortCode] ?? shortCode, daysSinceReview, status };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * `applicableKeys` — every applicability flag TRUE for this report/module
 * request (camelCase, e.g. ["euAiAct", "saudiPdpl"]) — caller's
 * responsibility to compute those first (see the two workspace pages for
 * how each does it). Only ever returns red/amber rows — green frameworks
 * have nothing worth surfacing to a reviewer mid-decision.
 */
export async function computeStalenessWarnings(applicableKeys: string[]): Promise<RegulatoryStalenessWarning[]> {
  const shortCodes = [...new Set(applicableKeys.flatMap((k) => APPLICABILITY_KEY_TO_SHORT_CODES[k] ?? []))];
  if (shortCodes.length === 0) return [];

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("regulatory_frameworks")
    .select("short_code, last_reviewed_at, staleness_threshold_days")
    .in("short_code", shortCodes);
  if (error) throw new Error(`computeStalenessWarnings: failed to load framework rows: ${error.message}`);

  return (rows ?? [])
    .map((r) => {
      const shortCode = r.short_code as string;
      const { daysSinceReview, status } = computeStatus({
        lastReviewedAt: r.last_reviewed_at as string | null,
        stalenessThresholdDays: r.staleness_threshold_days as number,
      });
      return { shortCode, label: JURISDICTION_LABELS[shortCode] ?? shortCode, daysSinceReview, status };
    })
    .filter((r): r is RegulatoryStalenessWarning => r.status !== "green")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "red" ? -1 : 1;
      return (b.daysSinceReview ?? Infinity) - (a.daysSinceReview ?? Infinity);
    });
}
