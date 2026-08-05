"use client";

import { useState } from "react";
import { updateCompanyProfile, type CompanyProfileFields } from "./actions";

export function BusinessProfileForm({ companyId, initial }: { companyId: string; initial: CompanyProfileFields }) {
  const [fields, setFields] = useState<CompanyProfileFields>(initial);
  const [socialLinksText, setSocialLinksText] = useState(initial.socialLinks.join(", "));
  const [toolsText, setToolsText] = useState(initial.mainToolsStack.join(", "));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof CompanyProfileFields>(key: K, value: CompanyProfileFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    setError(null);
    const next: CompanyProfileFields = {
      ...fields,
      socialLinks: socialLinksText.split(",").map((s) => s.trim()).filter(Boolean),
      mainToolsStack: toolsText.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const result = await updateCompanyProfile(companyId, initial, next);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Company name</span>
        <input className="w-full rounded border px-3 py-2 text-sm" value={fields.name} onChange={(e) => update("name", e.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Industry</span>
          <input className="w-full rounded border px-3 py-2 text-sm" value={fields.industry ?? ""} onChange={(e) => update("industry", e.target.value || null)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Business model</span>
          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={fields.businessModel ?? ""}
            onChange={(e) => update("businessModel", (e.target.value || null) as "B2B" | "B2C" | null)}
          >
            <option value="">Not set</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Employee count</span>
          <input
            type="number"
            className="w-full rounded border px-3 py-2 text-sm"
            value={fields.employeeCount ?? ""}
            onChange={(e) => update("employeeCount", e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Stage</span>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="e.g. seed, Series A, bootstrapped"
            value={fields.stage ?? ""}
            onChange={(e) => update("stage", e.target.value || null)}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Website URL</span>
        <input className="w-full rounded border px-3 py-2 text-sm" value={fields.websiteUrl ?? ""} onChange={(e) => update("websiteUrl", e.target.value || null)} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Social / review links (comma-separated)</span>
        <input className="w-full rounded border px-3 py-2 text-sm" value={socialLinksText} onChange={(e) => setSocialLinksText(e.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Revenue range band</span>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="e.g. £1m-£5m ARR"
            value={fields.revenueRangeBand ?? ""}
            onChange={(e) => update("revenueRangeBand", e.target.value || null)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Customer type</span>
          <input className="w-full rounded border px-3 py-2 text-sm" value={fields.customerType ?? ""} onChange={(e) => update("customerType", e.target.value || null)} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Main tools/stack (comma-separated)</span>
        <input className="w-full rounded border px-3 py-2 text-sm" value={toolsText} onChange={(e) => setToolsText(e.target.value)} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Team structure summary</span>
        <textarea
          rows={3}
          className="w-full rounded border px-3 py-2 text-sm"
          value={fields.teamStructureSummary ?? ""}
          onChange={(e) => update("teamStructureSummary", e.target.value || null)}
        />
      </label>

      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-600">Saved.</p>}

      <button
        onClick={handleSave}
        disabled={status === "saving"}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {status === "saving" ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
