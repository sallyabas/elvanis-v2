"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GovernanceDimensionDefinition, GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import { submitEvidence } from "./actions";
import { saveEvidenceIntakeDraft } from "@/lib/evidence/draft";
import { EXPORT_INSTRUCTIONS_BY_LENS, type EvidenceLensKey } from "@/lib/evidence/export-instructions";
import { EVIDENCE_FIELD_SETS } from "@/lib/evidence/field-sets";
import { REVIEW_PERIOD_HOURS } from "@/lib/reports/sla";

/** Shape of the draft blob saved/restored — mirrors this form's own local state, not a typed evidence submission (see evidence_intake_drafts migration docblock). */
interface EvidenceIntakeDraft {
  fieldValues?: Record<string, string>;
  namedCompetitors?: string;
  marketChangeNotes?: string;
  pricingPressureNotes?: string;
  lostDealsNotes?: string;
  hasLiveAiInProduction?: boolean;
  governanceDocsSubmitted?: boolean;
  governanceEvidenceText?: string;
  dimensionScores?: Partial<Record<GovernanceDimensionKey, number>>;
}

// Field labels now live in src/lib/evidence/field-sets.ts (confirmed
// 2026-08-06), shared with the client report page's "Evidence submitted"
// display — this form's own copy would otherwise drift from what the
// report page shows for the exact same fieldNames.
const FIELD_SETS = EVIDENCE_FIELD_SETS;

/**
 * Export instructions hint (confirmed 2026-08-06) — short, tool-specific
 * "where to click" steps guiding a client straight into the fields below
 * with the right figures already in hand. Not auto-parsing — the client
 * still reads the number off their own export and types it in; this just
 * removes the "where do I even find this" friction. Collapsed by default
 * (native <details>, no extra state) so it doesn't add length to an
 * already-long form for anyone who doesn't need it.
 *
 * Restyled 2026-08-06 (honest UX review pass) — two real findings, not
 * polish. First: this box previously used the identical gray
 * border/background as the two disclaimer boxes above it (Discovery
 * Session offer, privacy notice), so a real read-through trains the eye
 * to skim past all three as boilerplate — the one that's actually a
 * useful shortcut looked exactly like the two that are inert notices.
 * Given a distinct accent color and a "Tip" label so it reads as
 * "something to use," not "something to ignore." Second: each tool's
 * `note` (e.g. Jira's 1,000-issue export cap, HubSpot/Intercom/Zendesk
 * emailing the file instead of downloading it) previously rendered in
 * `text-neutral-400` — the single faintest text color used anywhere on
 * this page, fainter than the steps text above it. These are genuinely
 * actionable caveats, not fine print; now rendered in a distinctly
 * colored, bolded callout instead of fading them out.
 */
function ExportHints({ lens }: { lens: EvidenceLensKey }) {
  const tools = EXPORT_INSTRUCTIONS_BY_LENS[lens];
  return (
    <details className="mb-3 rounded border border-blue-200 bg-blue-50 text-xs dark:border-blue-900 dark:bg-blue-950">
      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-blue-800 dark:text-blue-300">
        <span className="mr-1 rounded bg-blue-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Tip
        </span>
        Using one of these tools? Quick export steps
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {tools.map((t) => (
          <div key={t.tool}>
            <span className="font-medium">{t.tool}:</span> <span className="text-neutral-700 dark:text-neutral-300">{t.steps}</span>
            {t.note && (
              <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {t.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

// REVIEW_PERIOD_HOURS now lives in src/lib/reports/sla.ts (confirmed
// 2026-08-06, honest UX review pass) — shared with the client report
// page's "still being reviewed" holding copy, so the two surfaces can
// never quote a different total-turnaround number for the same promise.

export function EvidenceIntakeForm({
  companyId,
  goalId,
  initialDraft,
  governanceDimensions,
  editWindowHours,
  isFreeAudit,
}: {
  companyId: string;
  goalId: string;
  initialDraft: EvidenceIntakeDraft | null;
  /**
   * DB-backed as of 2026-08-06 (see benchmarks-repository.ts) — fetched
   * server-side in page.tsx and passed down here, since GOVERNANCE_DIMENSIONS
   * can no longer be imported directly into a client component now that it's
   * an async DB read rather than a synchronous module-level const.
   */
  governanceDimensions: GovernanceDimensionDefinition[];
  /**
   * DB-backed (app_settings.edit_window_hours, confirmed 2026-08-06) —
   * fetched server-side and passed down so the confirmation modal's copy
   * reads the exact same value run-audit.ts uses to compute
   * edit_window_closes_at. Never a separately hardcoded "24 hours" string
   * — that divergence is the real gap this whole migration closes.
   */
  editWindowHours: number;
  /** Computed server-side from whether this company has any already-`sent` report — real free-tier state, not assumed. */
  isFreeAudit: boolean;
}) {
  const router = useRouter();

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(initialDraft?.fieldValues ?? {});
  const [namedCompetitors, setNamedCompetitors] = useState(initialDraft?.namedCompetitors ?? "");
  const [marketChangeNotes, setMarketChangeNotes] = useState(initialDraft?.marketChangeNotes ?? "");
  const [pricingPressureNotes, setPricingPressureNotes] = useState(initialDraft?.pricingPressureNotes ?? "");
  const [lostDealsNotes, setLostDealsNotes] = useState(initialDraft?.lostDealsNotes ?? "");

  const [hasLiveAiInProduction, setHasLiveAiInProduction] = useState(initialDraft?.hasLiveAiInProduction ?? false);
  const [governanceDocsSubmitted, setGovernanceDocsSubmitted] = useState(initialDraft?.governanceDocsSubmitted ?? false);
  const [governanceEvidenceText, setGovernanceEvidenceText] = useState(initialDraft?.governanceEvidenceText ?? "");
  const [dimensionScores, setDimensionScores] = useState<Partial<Record<GovernanceDimensionKey, number>>>(
    initialDraft?.dimensionScores ?? {},
  );

  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Saved draft intake (confirmed 2026-08-05, pulled forward from V2) —
   * debounced autosave, not a save-on-every-keystroke hammer. Skips the
   * very first render (whatever was just loaded from initialDraft doesn't
   * need to be immediately re-saved). Standard "sync to an external system"
   * effect, not the react-hooks/set-state-in-effect pattern already flagged
   * as a lesson elsewhere in this codebase (the demo prototype's timer bug)
   * — draftStatus is only set in response to the debounce timer firing or
   * the save resolving, never derived from another state value reacting to
   * itself.
   */
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const isFirstRender = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setDraftStatus("saving");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveEvidenceIntakeDraft(companyId, {
        fieldValues,
        namedCompetitors,
        marketChangeNotes,
        pricingPressureNotes,
        lostDealsNotes,
        hasLiveAiInProduction,
        governanceDocsSubmitted,
        governanceEvidenceText,
        dimensionScores,
      }).then(() => setDraftStatus("saved"));
    }, 1500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    companyId,
    fieldValues,
    namedCompetitors,
    marketChangeNotes,
    pricingPressureNotes,
    lostDealsNotes,
    hasLiveAiInProduction,
    governanceDocsSubmitted,
    governanceEvidenceText,
    dimensionScores,
  ]);

  function evidenceFieldsFor(lens: "financial" | "execution" | "product") {
    const set = FIELD_SETS.find((s) => s.lens === lens)!;
    return set.fields.map((f) => {
      const value = fieldValues[`${lens}.${f.key}`]?.trim() || null;
      return { fieldName: f.key, fieldValue: value, source: "manual" as const, isBlank: value === null };
    });
  }

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  /**
   * Real confirmation modal (confirmed 2026-08-06) — closes a gap found
   * while migrating edit_window_hours: spec §2.3a's "Submit for Review is
   * gated behind a confirmation modal" requirement was only ever actually
   * built in the demo prototype (mock data, never connected to Supabase).
   * The real live form went straight from the privacy checkbox to
   * submission with zero SLA disclosure — every real client so far
   * submitted evidence without ever seeing this. Form submit now opens
   * the modal instead of submitting directly; the actual submission moved
   * to handleConfirmSubmit, fired only from the modal's own Confirm button.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowConfirmModal(true);
  }

  async function handleConfirmSubmit() {
    setShowConfirmModal(false);
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
      // router.refresh() removed, confirmed 2026-08-07 — same fix as
      // OnboardingWizard.tsx and the login pages: redundant and racy
      // immediately after push(). The report page is fully dynamic
      // (session-dependent), so push() alone already forces a fresh
      // server render of it.
      router.push(`/reports/${result.reportId}`);
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="flex items-center justify-between">
        {initialDraft && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Resumed from your last saved draft.</p>
        )}
        <p className="ml-auto text-xs text-neutral-400" aria-live="polite">
          {draftStatus === "saving" ? "Saving…" : draftStatus === "saved" ? "Draft saved" : ""}
        </p>
      </div>

      {/* Upload-point micro-copy (spec §1.8, confirmed 2026-08-03) — shown right where evidence is entered, not buried in a footer link. */}
      <p className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        What you submit here is analyzed by Groq, our AI provider, to draft findings — every finding is reviewed by a
        human before you see it. We never share this with any other third party, and it&apos;s never used to train
        any AI model.
      </p>

      {FIELD_SETS.map((set) => (
        <section key={set.lens}>
          <h2 className="mb-3 text-lg font-medium">{set.title}</h2>
          <ExportHints lens={set.lens} />
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
        <ExportHints lens="commercial" />
        <div className="space-y-3">
          <label className="block space-y-1">
            {/* "(comma-separated)" was a technical formatting instruction, not
                natural language (confirmed 2026-08-06, honest UX review) —
                the placeholder example already shows the format without
                lecturing the user about it. */}
            <span className="text-sm font-medium">Named competitors</span>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="e.g. Competitor A, Competitor B"
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
              {governanceDimensions.map((dim) => (
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
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-40"
        >
          {status === "submitting" ? "Submitting…" : "Submit for review"}
        </button>
      </section>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
            <h3 className="mb-2 text-base font-semibold">Ready to submit?</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              You&apos;ll have {editWindowHours} hours to edit or add evidence — after that, review begins, and your
              report will be ready within {editWindowHours + REVIEW_PERIOD_HOURS} hours total.{" "}
              {isFreeAudit ? "This will use your free audit." : "This is a paid re-audit."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded border px-3 py-1.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
