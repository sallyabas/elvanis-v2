"use client";

import { Select } from "@/app/_components/ui/Select";
import { Input } from "@/app/_components/ui/Input";
import { TagInput } from "@/app/_components/ui/TagInput";
import { EU_COUNTRIES, OTHER_COUNTRY_SENTINEL, KNOWN_COUNTRIES } from "@/lib/onboarding/registration-country-options";

/**
 * The registration-country / UAE-free-zone / customer-market-countries
 * block — the exact three fields Tender Readiness's and Data Protection
 * Compliance's deterministic jurisdiction-applicability logic depend on.
 * Extracted 2026-09-04 from BusinessProfileForm.tsx (where this markup
 * originated, and where it's still used) so a second, near-identical copy
 * doesn't have to be hand-written for the new module-intake quick-setup
 * widget (item 5) — same "extracted so the two can't drift" reasoning
 * already applied to registration-country-options.ts itself.
 */
export interface JurisdictionFieldsValue {
  registrationCountry: string | null;
  uaeFreeZone: "mainland" | "difc" | "adgm" | null;
  customerMarketCountries: string[];
}

export function JurisdictionFieldsEditor({
  value,
  onChange,
}: {
  value: JurisdictionFieldsValue;
  onChange: (next: JurisdictionFieldsValue) => void;
}) {
  const isKnownCountry = !value.registrationCountry || KNOWN_COUNTRIES.includes(value.registrationCountry);
  const isUae = value.registrationCountry === "United Arab Emirates";

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Select
            label="Registration country"
            hint="Where the company is legally registered — used to determine which AI/data-protection regulations apply."
            value={isKnownCountry ? (value.registrationCountry ?? "") : OTHER_COUNTRY_SENTINEL}
            onChange={(e) =>
              onChange({
                ...value,
                registrationCountry: e.target.value === OTHER_COUNTRY_SENTINEL ? "" : e.target.value || null,
              })
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
              value={value.registrationCountry ?? ""}
              onChange={(e) => onChange({ ...value, registrationCountry: e.target.value || null })}
            />
          )}
        </div>
        {isUae ? (
          <Select
            label="UAE free zone (if applicable)"
            hint="DIFC and ADGM each have their own separate data-protection/AI regulations; mainland doesn't."
            value={value.uaeFreeZone ?? ""}
            onChange={(e) => onChange({ ...value, uaeFreeZone: (e.target.value || null) as "mainland" | "difc" | "adgm" | null })}
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
        value={value.customerMarketCountries}
        onChange={(tags) => onChange({ ...value, customerMarketCountries: tags })}
        placeholder="e.g. United Kingdom, Germany, Saudi Arabia…"
      />
    </>
  );
}
