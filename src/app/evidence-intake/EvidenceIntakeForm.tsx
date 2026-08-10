"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GovernanceDimensionDefinition, GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { MetricInput } from "@/lib/lenses/metrics";
import { submitEvidence } from "./actions";
import { saveEvidenceIntakeDraft } from "@/lib/evidence/draft";
import { EXPORT_INSTRUCTIONS_BY_LENS, type EvidenceLensKey } from "@/lib/evidence/export-instructions";
import { EVIDENCE_FIELD_SETS } from "@/lib/evidence/field-sets";
import { REVIEW_PERIOD_HOURS } from "@/lib/reports/sla";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/** Shape of the draft blob saved/restored — mirrors this form's own local state, not a typed evidence submission (see evidence_intake_drafts migration docblock). */
interface EvidenceIntakeDraft {
  fieldValues?: Record<string, string>;
  metricValues?: Record<string, string>;
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
  inProgressReportId,
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
  /**
   * Real duplicate-submission warning (confirmed 2026-08-10, real bug list
   * from live testing) — set when this company already has a
   * `pending_review`/`approved` report (computeJourneyStatus's "in_review"
   * stage) that hasn't been delivered yet. There is no "edit an existing
   * report in place" mechanism anywhere in this codebase (see run-audit.ts
   * — every submission creates a brand-new report and re-runs all five
   * lenses from scratch), so submitting again here does NOT edit that
   * report, it creates a second, separate one. Rather than silently allow
   * that confusion (or silently block a feature that might be intended),
   * this surfaces it honestly before the client resubmits.
   */
  inProgressReportId: string | null;
}) {
  const router = useRouter();

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(initialDraft?.fieldValues ?? {});
  /**
   * Real numeric metric fields (added 2026-08-07) — closes a real gap: the
   * deterministic compareFinancialMetric()/compareExecutionMetric()/
   * compareProductMetric() machinery was built and tested, but this form
   * never had a UI to actually collect the `metrics: MetricInput[]` those
   * functions run on, so `submitEvidence()` sent an empty array on every
   * real submission and benchmark comparisons never fired for a real
   * client. Kept as raw strings in state (not numbers) so an in-progress,
   * not-yet-valid entry (e.g. "6" while typing "68") doesn't get silently
   * coerced — parsed to MetricInput[] only at submit time, in metricsFor().
   */
  const [metricValues, setMetricValues] = useState<Record<string, string>>(initialDraft?.metricValues ?? {});
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
        metricValues,
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
    metricValues,
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

  /**
   * Real numeric metrics (added 2026-08-07) — parses only at submit time,
   * skipping anything blank or non-numeric rather than coercing it (an
   * invalid/in-progress entry should be silently dropped, not become a
   * wrong number the deterministic comparison then trusts as real).
   */
  function metricsFor(lens: "financial" | "execution" | "product"): MetricInput[] {
    const set = FIELD_SETS.find((s) => s.lens === lens)!;
    const result: MetricInput[] = [];
    for (const m of set.metrics) {
      const raw = metricValues[`${lens}.${m.metricKey}`]?.trim();
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isNaN(value)) continue;
      result.push({ metricKey: m.metricKey, value });
    }
    return result;
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
      financial: { evidenceFields: evidenceFieldsFor("financial"), metrics: metricsFor("financial") },
      execution: { evidenceFields: evidenceFieldsFor("execution"), metrics: metricsFor("execution") },
      product: { evidenceFields: evidenceFieldsFor("product"), metrics: metricsFor("product") },
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        {initialDraft && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Resumed from your last saved draft.</p>
        )}
        <p className="ml-auto text-xs text-neutral-400 dark:text-neutral-500" aria-live="polite">
          {draftStatus === "saving" ? "Saving…" : draftStatus === "saved" ? "Draft saved" : ""}
        </p>
      </div>

      {inProgressReportId && (
        <Alert variant="warning">
          You already have an audit in progress.{" "}
          <Link href={`/reports/${inProgressReportId}`} className="underline">
            View its status
          </Link>
          . Submitting this form starts a <span className="font-medium">second, separate</span> audit — it won&apos;t
          update or replace the one already in progress.
        </Alert>
      )}

      {/* Upload-point micro-copy (spec §1.8, confirmed 2026-08-03) — shown right where evidence is entered, not buried in a footer link. */}
      <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        What you submit here is analyzed by Groq, our AI provider, to draft findings — every finding is reviewed by a
        human before you see it. We never share this with any other third party, and it&apos;s never used to train
        any AI model.
      </p>

      {FIELD_SETS.map((set) => (
        <Card key={set.lens} title={set.title}>
          <ExportHints lens={set.lens} />

          {set.metrics.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Key metrics (optional — used for benchmark comparisons in your report)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {set.metrics.map((m) => (
                  <Input
                    key={m.metricKey}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    label={m.unit ? `${m.label} (${m.unit})` : m.label}
                    hint={m.hint}
                    placeholder={m.placeholder}
                    value={metricValues[`${set.lens}.${m.metricKey}`] ?? ""}
                    onChange={(e) => setMetricValues((prev) => ({ ...prev, [`${set.lens}.${m.metricKey}`]: e.target.value }))}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {set.fields.map((f) => (
              <Textarea
                key={f.key}
                rows={2}
                label={f.label}
                placeholder={f.placeholder}
                value={fieldValues[`${set.lens}.${f.key}`] ?? ""}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [`${set.lens}.${f.key}`]: e.target.value }))}
              />
            ))}
          </div>
        </Card>
      ))}

      <Card title="Commercial / Market">
        <ExportHints lens="commercial" />
        <div className="space-y-4">
          {/* "(comma-separated)" was a technical formatting instruction, not
              natural language (confirmed 2026-08-06, honest UX review) —
              the placeholder example already shows the format without
              lecturing the user about it. */}
          <Input
            label="Named competitors"
            placeholder="e.g. Competitor A, Competitor B"
            value={namedCompetitors}
            onChange={(e) => setNamedCompetitors(e.target.value)}
          />
          <Textarea label="Market change notes" rows={2} value={marketChangeNotes} onChange={(e) => setMarketChangeNotes(e.target.value)} />
          <Textarea label="Pricing pressure notes" rows={2} value={pricingPressureNotes} onChange={(e) => setPricingPressureNotes(e.target.value)} />
          <Textarea label="Lost deals notes" rows={2} value={lostDealsNotes} onChange={(e) => setLostDealsNotes(e.target.value)} />
        </div>
      </Card>

      <Card title="AI & Governance">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={hasLiveAiInProduction}
              onChange={(e) => setHasLiveAiInProduction(e.target.checked)}
            />
            We have live AI in production today
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={governanceDocsSubmitted}
              onChange={(e) => setGovernanceDocsSubmitted(e.target.checked)}
            />
            We have AI governance documentation to describe
          </label>

          {governanceDocsSubmitted ? (
            <Textarea
              label="Describe your governance documentation"
              rows={4}
              placeholder="e.g. our AI use policy, risk classification process, incident response plan…"
              value={governanceEvidenceText}
              onChange={(e) => setGovernanceEvidenceText(e.target.value)}
            />
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No documents? Rate where each area actually stands today.</p>
              {governanceDimensions.map((dim) => (
                <Select
                  key={dim.key}
                  label={dim.label}
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
                </Select>
              ))}
            </div>
          )}
        </div>
      </Card>

      <section className="space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <label className="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={privacyAcknowledged}
            onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
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

        {status === "error" && error && <Alert variant="error">{error}</Alert>}

        <Button type="submit" disabled={status === "submitting" || !privacyAcknowledged}>
          {status === "submitting" ? "Submitting…" : "Submit for review"}
        </Button>
      </section>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
            <h3 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">Ready to submit?</h3>
            {/* Wording corrected 2026-08-10 (direct founder request, following
                the real bug list pass) — "edit or add evidence" previously
                implied true in-place editing, which doesn't exist in this
                codebase: submitting again during the window creates a
                separate, new report rather than updating this one (see
                run-audit.ts — every submission is a fresh audit run, full
                stop). Confirmed decision: for pilot, this real behavior is
                fine as-is — the fix needed is honest copy, not building
                real edit-in-place. */}
            {/*
             * Real, subtle bug found and fixed 2026-08-10 while verifying
             * the fix above: a literal space immediately after an
             * expression (e.g. "{editWindowHours} hours") is silently
             * dropped by JSX's whitespace-collapse rule whenever that text
             * node spans multiple source lines (confirmed live via
             * childNodes inspection — rendered as "24hours", no space,
             * despite a real space in the source). This is very likely
             * the exact mechanism behind the "missing space in '72hours'"
             * typo from the original bug report — a real, reproducible
             * JSX gotcha, not something a source grep for the literal
             * string would ever catch. Fixed everywhere in this paragraph
             * by using an explicit {" "} right after every expression
             * whose following text could wrap onto a new line, instead of
             * relying on a plain space character surviving JSX's
             * line-based trimming.
             */}
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              You&apos;ll have {editWindowHours}{" "}
              hours before review begins. There&apos;s no in-place editing — if you
              need to change or add anything during that window, submitting again creates a separate, new report
              rather than updating this one. After {editWindowHours}h, reviewers take over and your report will be
              ready within {editWindowHours + REVIEW_PERIOD_HOURS}{" "}
              hours total.{" "}
              {isFreeAudit ? "This will use your free audit." : "This is a paid re-audit."}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowConfirmModal(false)} className="px-3 py-1.5">
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmSubmit} className="px-3 py-1.5">
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Real loading indicator (confirmed 2026-08-10, real bug list from
          live testing) — closes a real gap: submitEvidence() runs all five
          lenses server-side (staggered ~1.5s apart, each a real Groq call,
          see run-audit.ts), which can genuinely take well over a minute.
          Before this, the only feedback was a disabled button reading
          "Submitting…" — easy to miss entirely if the client had scrolled
          away from it, making the page look frozen/broken rather than
          working. This overlay is impossible to miss and explains what's
          actually happening rather than leaving a blank wait. */}
      {status === "submitting" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg dark:bg-neutral-900">
            <div
              className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-accent dark:border-neutral-700"
              aria-hidden="true"
            />
            <h3 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">
              Analyzing your evidence…
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              We&apos;re running your Financial, Execution, Product, Commercial, and AI &amp; Governance analysis.
              This usually takes under a minute — please don&apos;t close this tab.
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
