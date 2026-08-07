"use client";

import { useState } from "react";
import { updateCompanyProfile, type CompanyProfileFields } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Select } from "@/app/_components/ui/Select";
import { Textarea } from "@/app/_components/ui/Textarea";
import { TagInput } from "@/app/_components/ui/TagInput";
import { Button } from "@/app/_components/ui/Button";

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

      {status === "error" && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

      <Button onClick={handleSave} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
