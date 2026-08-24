"use client";

import { useState } from "react";
import { updateCompanyProfile, type CompanyProfileFields } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Select } from "@/app/_components/ui/Select";
import { Textarea } from "@/app/_components/ui/Textarea";
import { TagInput } from "@/app/_components/ui/TagInput";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * Real design pass, confirmed 2026-08-07 — Business Profile treated as
 * the reference fix for every form in the app (see CLAUDE.md). Four
 * concrete gaps closed, not just brand colors layered on top:
 *
 * 1. Revenue range band is now a real dropdown of fixed bands, not a
 *    free-text field — "£1m-£5m ARR" vs "1-5m ARR" vs "£1,000,000-
 *    £5,000,000" were all valid-looking answers to the same free-text
 *    field before, which is exactly the kind of inconsistency a fixed
 *    band exists to prevent. The DB column stays plain text (no schema
 *    change needed) — the dropdown just constrains what gets written to
 *    it. Any pre-existing value that doesn't match one of the defined
 *    bands (a real possibility for any row saved before this change) is
 *    added as its own selectable option rather than silently dropped, so
 *    an existing answer is never destroyed by this becoming a dropdown.
 * 2. Every previously bare field now has a real placeholder/hint showing
 *    what a good answer looks like, not just an empty box.
 * 3. Social links and Main tools/stack — the two fields literally labeled
 *    "(comma-separated)" — are now a real tag-input UI (see
 *    TagInput.tsx), not a plain text field relying on the client already
 *    knowing to type commas.
 * 4. Every field now uses the shared Input/Select/Textarea primitives
 *    (see src/app/_components/ui/) instead of a bare `className="w-full
 *    rounded border px-3 py-2 text-sm"` with no border color specified
 *    (rendering as the browser default) — this was the real gap behind
 *    "looks old": the bones of the form were never actually styled, only
 *    the accent color was added on top of nav/buttons.
 */

const REVENUE_BANDS = [
  "Pre-revenue",
  "£0 – £100k ARR",
  "£100k – £500k ARR",
  "£500k – £1m ARR",
  "£1m – £5m ARR",
  "£5m – £20m ARR",
  "£20m+ ARR",
];

/**
 * Real gap found and closed 2026-08-15 (module intake/service flow
 * review) — canonical country names, matching exactly what
 * src/lib/modules/shared/regions.ts's normalize()-based matching
 * recognizes (UK_NAMES/EU_MEMBER_STATES/SAUDI_ARABIA_NAMES/UAE_NAMES),
 * the deterministic logic Tender Readiness and Data Protection Compliance
 * both depend on. A dropdown, not free text, for the same reason
 * Revenue range band is a dropdown — "UK" vs "United Kingdom" vs "Great
 * Britain" would all look like valid answers but only some normalize to a
 * name the jurisdiction logic actually matches. "Other" stays real free
 * text, since a company can genuinely be registered somewhere none of
 * these jurisdiction modules currently have logic for — the dropdown
 * exists to prevent AMBIGUITY among the recognized set, not to claim this
 * app understands every country's regulatory regime.
 */
const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark",
  "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland",
  "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
];
const OTHER_COUNTRY_SENTINEL = "__other__";

export function BusinessProfileForm({ companyId, initial }: { companyId: string; initial: CompanyProfileFields }) {
  const [fields, setFields] = useState<CompanyProfileFields>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof CompanyProfileFields>(key: K, value: CompanyProfileFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    setError(null);
    const result = await updateCompanyProfile(companyId, initial, fields);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  // Preserves a pre-existing free-text value that predates the dropdown,
  // rather than silently dropping it the moment this field becomes a
  // fixed set of options.
  const revenueBandOptions =
    fields.revenueRangeBand && !REVENUE_BANDS.includes(fields.revenueRangeBand)
      ? [fields.revenueRangeBand, ...REVENUE_BANDS]
      : REVENUE_BANDS;

  const KNOWN_COUNTRIES = ["United Kingdom", ...EU_COUNTRIES, "Saudi Arabia", "United Arab Emirates"];
  const isKnownCountry = !fields.registrationCountry || KNOWN_COUNTRIES.includes(fields.registrationCountry);
  const isUae = fields.registrationCountry === "United Arab Emirates";

  return (
    <div className="space-y-5">
      <Input label="Company name" value={fields.name} onChange={(e) => update("name", e.target.value)} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Industry"
          placeholder="e.g. B2B SaaS — marketing analytics"
          value={fields.industry ?? ""}
          onChange={(e) => update("industry", e.target.value || null)}
        />
        <Select
          label="Business model"
          value={fields.businessModel ?? ""}
          onChange={(e) => update("businessModel", (e.target.value || null) as "B2B" | "B2C" | null)}
        >
          <option value="">Not set</option>
          <option value="B2B">B2B</option>
          <option value="B2C">B2C</option>
        </Select>
        <Input
          label="Employee count"
          type="number"
          placeholder="e.g. 45"
          value={fields.employeeCount ?? ""}
          onChange={(e) => update("employeeCount", e.target.value === "" ? null : Number(e.target.value))}
        />
        <Input
          label="Stage"
          placeholder="e.g. seed, Series A, bootstrapped"
          value={fields.stage ?? ""}
          onChange={(e) => update("stage", e.target.value || null)}
        />
      </div>

      <Input
        label="Website URL"
        placeholder="https://acme.com"
        value={fields.websiteUrl ?? ""}
        onChange={(e) => update("websiteUrl", e.target.value || null)}
      />

      <TagInput
        label="Social / review links"
        hint="Press Enter after each one — e.g. LinkedIn, Trustpilot, or G2 profile URLs."
        value={fields.socialLinks}
        onChange={(tags) => update("socialLinks", tags)}
        placeholder="Paste a link and press Enter…"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Revenue range band"
          hint="A fixed band, not an exact figure — this is what lenses benchmark against."
          value={fields.revenueRangeBand ?? ""}
          onChange={(e) => update("revenueRangeBand", e.target.value || null)}
        >
          <option value="">Not set</option>
          {revenueBandOptions.map((band) => (
            <option key={band} value={band}>
              {band}
            </option>
          ))}
        </Select>
        <Input
          label="Customer type"
          placeholder="e.g. SMEs, enterprise, consumers"
          value={fields.customerType ?? ""}
          onChange={(e) => update("customerType", e.target.value || null)}
        />
      </div>

      {/* Real gap found and closed 2026-08-15 (module intake/service flow
          review) — these three fields drive Tender Readiness's and Data
          Protection Compliance's deterministic jurisdiction-applicability
          logic, but had never been settable anywhere in the client-facing
          app until now; a company with these genuinely blank correctly
          computed "no jurisdiction applies," which is honest but was
          previously the ONLY possible outcome for every real client. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Select
            label="Registration country"
            hint="Where the company is legally registered — used to determine which AI/data-protection regulations apply."
            value={isKnownCountry ? (fields.registrationCountry ?? "") : OTHER_COUNTRY_SENTINEL}
            onChange={(e) =>
              update("registrationCountry", e.target.value === OTHER_COUNTRY_SENTINEL ? "" : e.target.value || null)
            }
          >
            <option value="">Not set</option>
            <option value="United Kingdom">United Kingdom</option>
            <optgroup label="European Union">
              {EU_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            <optgroup label="Gulf">
              <option value="Saudi Arabia">Saudi Arabia</option>
              <option value="United Arab Emirates">United Arab Emirates</option>
            </optgroup>
            <option value={OTHER_COUNTRY_SENTINEL}>Other / not listed</option>
          </Select>
          {!isKnownCountry && (
            <Input
              placeholder="Type the registration country"
              value={fields.registrationCountry ?? ""}
              onChange={(e) => update("registrationCountry", e.target.value || null)}
            />
          )}
        </div>
        {isUae ? (
          <Select
            label="UAE free zone (if applicable)"
            hint="DIFC has its own AI-specific regulation (Reg. 10); ADGM and mainland don't."
            value={fields.uaeFreeZone ?? ""}
            onChange={(e) => update("uaeFreeZone", (e.target.value || null) as "mainland" | "difc" | "adgm" | null)}
          >
            <option value="">Not set</option>
            <option value="mainland">Mainland</option>
            <option value="difc">DIFC</option>
            <option value="adgm">ADGM</option>
          </Select>
        ) : (
          <div />
        )}
      </div>

      <TagInput
        label="Customer market countries"
        hint="Press Enter after each one — where your customers are, not where you're registered. Also drives jurisdiction applicability (e.g. GDPR applies based on EU customers, regardless of registration)."
        value={fields.customerMarketCountries}
        onChange={(tags) => update("customerMarketCountries", tags)}
        placeholder="e.g. United Kingdom, Germany, Saudi Arabia…"
      />

      <TagInput
        label="Main tools/stack"
        hint="Press Enter after each one — the tools whose exports you'd submit as evidence."
        value={fields.mainToolsStack}
        onChange={(tags) => update("mainToolsStack", tags)}
        placeholder="e.g. Xero, HubSpot, Jira…"
      />

      <Textarea
        label="Team structure summary"
        hint='e.g. "12 people across eng, sales, and support; flat structure, no formal management layers yet."'
        rows={3}
        value={fields.teamStructureSummary ?? ""}
        onChange={(e) => update("teamStructureSummary", e.target.value || null)}
      />

      {/* Real, early-captured field (confirmed 2026-08-20, item 5 of the
          external-feedback batch) — previously only askable at Evidence
          Intake, buried in a JSON evidence blob. Same tri-state pattern as
          Business model above: "Not set" genuinely means not yet answered,
          not "no." Evidence Intake's own checkbox pre-fills from this and
          writes back to it on submit, so it stays current going forward. */}
      <Select
        label="Do you have AI in production today?"
        hint="Live AI features actually running for real users, not internal experiments — used to flag governance urgency in your audit."
        value={fields.hasAiInProduction === null ? "" : fields.hasAiInProduction ? "yes" : "no"}
        onChange={(e) => update("hasAiInProduction", e.target.value === "" ? null : e.target.value === "yes")}
      >
        <option value="">Not set</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>

      {status === "error" && error && <Alert variant="error">{error}</Alert>}
      {status === "saved" && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

      <Button onClick={handleSave} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
