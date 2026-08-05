"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GOVERNANCE_DIMENSIONS } from "@/lib/lenses/ai-governance-framework";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import { submitEvidence } from "./actions";

const FIELD_SETS: {
  lens: "financial" | "execution" | "product";
  title: string;
  fields: { key: string; label: string; placeholder: string }[];
}[] = [
  {
    lens: "financial",
    title: "Financial",
    fields: [
      { key: "revenue_margin_trends", label: "Revenue and margin trends", placeholder: "How has revenue/margin moved recently? Any notable swings?" },
      { key: "cash_flow_runway", label: "Cash flow / runway situation", placeholder: "How much runway do you have? Any cash flow concerns?" },
      { key: "cost_structure", label: "Cost structure notes", placeholder: "What are the biggest cost drivers? Anything creeping up?" },
      { key: "customer_concentration", label: "Customer concentration", placeholder: "Is revenue concentrated in a few large customers?" },
    ],
  },
  {
    lens: "execution",
    title: "Execution / Operating",
    fields: [
      { key: "team_delivery_process", label: "Team structure and delivery process", placeholder: "How is the team organized? What's the delivery process like?" },
      { key: "delivery_speed", label: "Recent delivery speed / delays", placeholder: "Any recent delays or slowdowns in shipping work?" },
      { key: "meeting_load", label: "Meeting load / decision-making friction", placeholder: "How much time goes to meetings? Do decisions get stuck?" },
      { key: "financial_visibility", label: "Visibility into financial data", placeholder: "How easily can the team see financial numbers day-to-day?" },
    ],
  },
  {
    lens: "product",
    title: "Product / Customer",
    fields: [
      { key: "usage_adoption", label: "Usage and adoption patterns", placeholder: "How are customers actually using the product?" },
      { key: "satisfaction_signals", label: "Customer satisfaction signals", placeholder: "NPS, support tickets, direct feedback — anything notable?" },
      { key: "churn_patterns", label: "Churn patterns", placeholder: "Who's churning and why, if known?" },
      { key: "activation_onboarding", label: "Activation / onboarding notes", placeholder: "How well do new customers get to their first value?" },
    ],
  },
];

export function EvidenceIntakeForm({ companyId, goalId }: { companyId: string; goalId: string }) {
  const router = useRouter();

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [namedCompetitors, setNamedCompetitors] = useState("");
  const [marketChangeNotes, setMarketChangeNotes] = useState("");
  const [pricingPressureNotes, setPricingPressureNotes] = useState("");
  const [lostDealsNotes, setLostDealsNotes] = useState("");

  const [hasLiveAiInProduction, setHasLiveAiInProduction] = useState(false);
  const [governanceDocsSubmitted, setGovernanceDocsSubmitted] = useState(false);
  const [governanceEvidenceText, setGovernanceEvidenceText] = useState("");
  const [dimensionScores, setDimensionScores] = useState<Partial<Record<GovernanceDimensionKey, number>>>({});

  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function evidenceFieldsFor(lens: "financial" | "execution" | "product") {
    const set = FIELD_SETS.find((s) => s.lens === lens)!;
    return set.fields.map((f) => {
      const value = fieldValues[`${lens}.${f.key}`]?.trim() || null;
      return { fieldName: f.key, fieldValue: value, source: "manual" as const, isBlank: value === null };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const result = await submitEvidence({
      companyId,
      goalId,
      privacyAcknowledged,
      financial: { evidenceFields: evidenceFieldsFor("financial") },
      execution: { evidenceFields: evidenceFieldsFor("execution") },
      product: { evidenceFields: evidenceFieldsFor("product") },
      commercial: {
        namedCompetitors: namedCompetitors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        marketChangeNotes: marketChangeNotes.trim() || null,
        pricingPressureNotes: pricingPressureNotes.trim() || null,
        lostDealsNotes: lostDealsNotes.trim() || null,
      },
      aiGovernance: {
        hasLiveAiInProduction,
        governanceDocsSubmitted,
        ...(governanceDocsSubmitted
          ? {
              governanceEvidence: governanceEvidenceText.trim()
                ? [{ fieldName: "governance_documentation", fieldValue: governanceEvidenceText.trim(), source: "manual" as const, isBlank: false }]
                : [],
            }
          : { questionnaireScores: dimensionScores }),
      },
    });

    if (result.success) {
      router.push(`/reports/${result.reportId}`);
      router.refresh();
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Upload-point micro-copy (spec §1.8, confirmed 2026-08-03) — shown right where evidence is entered, not buried in a footer link. */}
      <p className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        What you submit here is analyzed by Groq, our AI provider, to draft findings — every finding is reviewed by a
        human before you see it. We never share this with any other third party, and it&apos;s never used to train
        any AI model.
      </p>

      {FIELD_SETS.map((set) => (
        <section key={set.lens}>
          <h2 className="mb-3 text-lg font-medium">{set.title}</h2>
          <div className="space-y-3">
            {set.fields.map((f) => (
              <label key={f.key} className="block space-y-1">
                <span className="text-sm font-medium">{f.label}</span>
                <textarea
                  rows={2}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder={f.placeholder}
                  value={fieldValues[`${set.lens}.${f.key}`] ?? ""}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [`${set.lens}.${f.key}`]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-3 text-lg font-medium">Commercial / Market</h2>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Named competitors (comma-separated)</span>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Competitor A, Competitor B"
              value={namedCompetitors}
              onChange={(e) => setNamedCompetitors(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Market change notes</span>
            <textarea rows={2} className="w-full rounded border px-3 py-2 text-sm" value={marketChangeNotes} onChange={(e) => setMarketChangeNotes(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Pricing pressure notes</span>
            <textarea rows={2} className="w-full rounded border px-3 py-2 text-sm" value={pricingPressureNotes} onChange={(e) => setPricingPressureNotes(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Lost deals notes</span>
            <textarea rows={2} className="w-full rounded border px-3 py-2 text-sm" value={lostDealsNotes} onChange={(e) => setLostDealsNotes(e.target.value)} />
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">AI &amp; Governance</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasLiveAiInProduction} onChange={(e) => setHasLiveAiInProduction(e.target.checked)} />
            We have live AI in production today
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={governanceDocsSubmitted} onChange={(e) => setGovernanceDocsSubmitted(e.target.checked)} />
            We have AI governance documentation to describe
          </label>

          {governanceDocsSubmitted ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Describe your governance documentation</span>
              <textarea
                rows={4}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="e.g. our AI use policy, risk classification process, incident response plan…"
                value={governanceEvidenceText}
                onChange={(e) => setGovernanceEvidenceText(e.target.value)}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">No documents? Rate where each area actually stands today.</p>
              {GOVERNANCE_DIMENSIONS.map((dim) => (
                <label key={dim.key} className="block space-y-1">
                  <span className="text-sm font-medium">{dim.label}</span>
                  <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={dimensionScores[dim.key] ?? ""}
                    onChange={(e) =>
                      setDimensionScores((prev) => ({ ...prev, [dim.key]: e.target.value === "" ? undefined : Number(e.target.value) }))
                    }
                  >
                    <option value="">Not sure</option>
                    {dim.levels.map((level, i) => (
                      <option key={i} value={i}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={privacyAcknowledged} onChange={(e) => setPrivacyAcknowledged(e.target.checked)} className="mt-0.5" />
          <span>
            I&apos;ve read and accept the{" "}
            <Link href="/privacy" target="_blank" className="underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" target="_blank" className="underline">
              Terms of Service
            </Link>
            .
          </span>
        </label>

        {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={status === "submitting" || !privacyAcknowledged}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {status === "submitting" ? "Submitting…" : "Submit for review"}
        </button>
      </section>
    </form>
  );
}
