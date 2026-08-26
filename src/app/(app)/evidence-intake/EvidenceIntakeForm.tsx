"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GovernanceDimensionDefinition, GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { MetricInput } from "@/lib/lenses/metrics";
import { submitEvidence, submitEvidenceNow } from "./actions";
import { saveEvidenceIntakeDraft } from "@/lib/evidence/draft";
import type { EvidenceIntakeDraft } from "@/lib/evidence/draft-shape";
import { EXPORT_INSTRUCTIONS_BY_LENS, type EvidenceLensKey } from "@/lib/evidence/export-instructions";
import { EVIDENCE_FIELD_SETS, COMMERCIAL_METRICS } from "@/lib/evidence/field-sets";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { TagInput } from "@/app/_components/ui/TagInput";
import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { DocumentUploadField } from "@/app/_components/ui/DocumentUploadField";
import { EditWindowCountdown } from "@/app/_components/EditWindowCountdown";

// EvidenceIntakeDraft moved to draft-shape.ts (confirmed 2026-08-10,
// delayed-execution architecture) — a server component (evidence-intake/
// page.tsx) now also needs this type, to convert a real
// pending_evidence_submissions.evidence_payload back into the form's own
// draft shape when a client returns to actually use their edit window.

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

export function EvidenceIntakeForm({
  companyId,
  goalId,
  initialDraft,
  governanceDimensions,
  editWindowHours,
  reviewPeriodHours,
  isFreeAudit,
  isEditingExisting,
  editWindowClosesAt,
  submittedAt,
  updatedAt,
  initialHasAiInProduction,
  privacyAlreadyAcknowledged,
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
  /**
   * DB-backed (app_settings.review_period_hours, confirmed 2026-08-12) —
   * same reasoning as editWindowHours: the "N hours total" promise in the
   * confirmation modal used to add a hardcoded REVIEW_PERIOD_HOURS
   * constant, which is no longer importable directly into a client
   * component now that it's a real, enforced DB value (see sla.ts).
   */
  reviewPeriodHours: number;
  /** Computed server-side from whether this company has any already-`sent` report — real free-tier state, not assumed. */
  isFreeAudit: boolean;
  /**
   * True when a real, active 'editing' pending_evidence_submissions row
   * already exists for this company (confirmed 2026-08-10, delayed-
   * execution architecture) — Confirm now genuinely UPDATES that same
   * record in place rather than creating anything new, so the modal copy
   * below is worded differently for a first submission vs. a real edit.
   */
  isEditingExisting: boolean;
  /**
   * The real deadline for the ACTIVE submission, if one exists (confirmed
   * 2026-08-11, "Submit now" + countdown-clarity pass) — null on a
   * genuinely first-ever submission, since there's no window to count
   * down yet. Drives both the live countdown shown directly above this
   * form (not just on Dashboard/NextStepBanner — the founder specifically
   * asked for the timer to sit next to "review and change anything
   * below") and the "Submit now" fast-track, which only makes sense once
   * an edit window actually exists to close early.
   */
  editWindowClosesAt: string | null;
  /**
   * Real submission/edit dates (confirmed 2026-08-12, real bug list item
   * #4: "the client has no visible history of their own evidence intake —
   * submission date, edit date... are not retained/viewable anywhere on
   * their side"). Both null on a genuinely first-ever submission, same
   * reasoning as editWindowClosesAt above.
   */
  submittedAt: string | null;
  updatedAt: string | null;
  /**
   * Real, dedicated company-level value (confirmed 2026-08-20, item 5 of
   * the external-feedback batch) — pre-fills the checkbox below from
   * whatever was captured earlier at Business Profile (or a prior
   * submission), instead of always defaulting to unanswered/false.
   * initialDraft's own value still wins when present (an in-progress edit
   * the client hasn't submitted yet shouldn't be silently overwritten by
   * the company's last-confirmed value).
   */
  initialHasAiInProduction: boolean | null;
  /**
   * Real, previously-persisted acknowledgment (added 2026-08-25, real
   * friction fix from honest live testing) — `companies.privacy_acknowledged_at`
   * is a real, permanent record stamped by submitEvidence() the first time
   * this company ever genuinely accepted the Privacy Policy/ToS ("stamped
   * here, at the actual point of first real evidence submission... only
   * writes it the first time" — see that function's own docblock). The
   * checkbox previously always defaulted to unchecked regardless of this,
   * meaning a client who had already genuinely accepted once had to
   * re-check the exact same box every single time they merely navigated
   * away (even just to glance at Dashboard) and back during their own
   * still-open edit window — real, confirmed friction, not a meaningful
   * re-confirmation (unlike, say, Tender Readiness's deliberate
   * confirm-without-docs gate, which asks about something that can
   * genuinely change). Still fully uncheckable — this only fixes the
   * default, never forces or hides the checkbox.
   */
  privacyAlreadyAcknowledged: boolean;
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
  // Real TagInput-backed tags array (confirmed 2026-08-25, converted from
  // a plain comma-separated text Input for consistency with identical
  // fields elsewhere — Business Profile's Social links/Tools stack).
  // Defensive normalization, not a blind cast: a draft saved before this
  // date may still hold the old joined-string shape (draftData is opaque
  // JSON, never migrated) — a real, disposable test account's own
  // pre-existing draft could hit this, so this must not crash on it.
  const [namedCompetitors, setNamedCompetitors] = useState<string[]>(() => {
    const raw = initialDraft?.namedCompetitors as unknown;
    if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === "string");
    if (typeof raw === "string") return raw.split(",").map((c) => c.trim()).filter(Boolean);
    return [];
  });
  const [marketChangeNotes, setMarketChangeNotes] = useState(initialDraft?.marketChangeNotes ?? "");
  const [pricingPressureNotes, setPricingPressureNotes] = useState(initialDraft?.pricingPressureNotes ?? "");
  const [lostDealsNotes, setLostDealsNotes] = useState(initialDraft?.lostDealsNotes ?? "");

  const [hasLiveAiInProduction, setHasLiveAiInProduction] = useState(initialDraft?.hasLiveAiInProduction ?? initialHasAiInProduction ?? false);
  const [governanceDocsSubmitted, setGovernanceDocsSubmitted] = useState(initialDraft?.governanceDocsSubmitted ?? false);
  const [governanceEvidenceText, setGovernanceEvidenceText] = useState(initialDraft?.governanceEvidenceText ?? "");
  /**
   * Real document upload (confirmed 2026-08-12, direct founder request) —
   * tracks whether the current governanceEvidenceText came from a real
   * uploaded PDF/DOCX (EvidenceFieldInput's `source` field already
   * supported "parsed" in the type system, unused until now) or was typed
   * by the client. Flips back to "manual" the moment the client edits the
   * textarea after an upload, since hand-edited text is no longer purely
   * the extracted document. Resets to "manual" on a fresh draft reload —
   * the draft mechanism doesn't persist this distinction, a deliberate,
   * disclosed simplification since it only affects prompt-quality
   * signaling, not any gating logic.
   */
  const [governanceEvidenceSource, setGovernanceEvidenceSource] = useState<"manual" | "parsed">("manual");
  const [dimensionScores, setDimensionScores] = useState<Partial<Record<GovernanceDimensionKey, number>>>(
    initialDraft?.dimensionScores ?? {},
  );

  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(privacyAlreadyAcknowledged);
  /**
   * "submitting-now" is a genuinely different state from "submitting"
   * (confirmed 2026-08-11, "Submit now" fast-track), not a cosmetic
   * rename — "submitting" is the fast, sub-second evidence-record write
   * every normal submit does; "submitting-now" is a real, synchronous
   * five-lens Groq run (same actual duration the pre-delayed-execution
   * architecture used to show a loading state for) and needs its own
   * honest copy, not the brief "Saving your evidence…" message.
   */
  const [status, setStatus] = useState<"idle" | "submitting" | "submitting-now" | "error">("idle");
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

  /**
   * Real numeric-field validation (confirmed 2026-08-10, live testing pass)
   * — closes a real gap: `type="number"` alone doesn't reliably block
   * every way invalid text can land in the field (paste, some mobile
   * keyboards), and the previous behavior was to silently DROP an
   * unparseable value at submit time with zero feedback — a client could
   * type something that never made it into their report and never know.
   * Now shown as a real inline error the moment it's typed, and submission
   * is blocked while any metric field is invalid, not just filtered out
   * quietly server-side.
   */
  function metricError(raw: string | undefined): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null; // blank is meaningful too, not an error
    return Number.isFinite(Number(trimmed)) ? null : "Enter a number";
  }
  const hasInvalidMetric = Object.values(metricValues).some((v) => metricError(v) !== null);

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
    return parseMetrics(lens, set.metrics.map((m) => m.metricKey));
  }

  /**
   * Commercial's own metrics (added 2026-08-25, real gap fix — see
   * COMMERCIAL_METRICS's own docblock in field-sets.ts). Commercial isn't
   * part of FIELD_SETS (its Card is hand-built below, not generic), so
   * this reads from COMMERCIAL_METRICS directly instead of metricsFor()'s
   * FIELD_SETS lookup — same parsing logic, shared via parseMetrics().
   */
  function commercialMetricsFor(): MetricInput[] {
    return parseMetrics("commercial", COMMERCIAL_METRICS.map((m) => m.metricKey));
  }

  function parseMetrics(lens: string, metricKeys: string[]): MetricInput[] {
    const result: MetricInput[] = [];
    for (const metricKey of metricKeys) {
      const raw = metricValues[`${lens}.${metricKey}`]?.trim();
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isNaN(value)) continue;
      result.push({ metricKey, value });
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
    if (hasInvalidMetric) return; // safety guard behind the disabled button, not just decorative
    setShowConfirmModal(true);
  }

  /**
   * Shared payload builder (confirmed 2026-08-11, "Submit now" fast-track)
   * — the normal submit and the fast-track submit must send the EXACT
   * same evidence shape, since "Submit now" is explicitly meant to close
   * out whatever's currently in the form, not some separately-derived
   * subset. Extracted rather than duplicated so the two paths can't drift.
   */
  function buildSubmitInput() {
    return {
      companyId,
      goalId,
      privacyAcknowledged,
      financial: { evidenceFields: evidenceFieldsFor("financial"), metrics: metricsFor("financial") },
      execution: { evidenceFields: evidenceFieldsFor("execution"), metrics: metricsFor("execution") },
      product: { evidenceFields: evidenceFieldsFor("product"), metrics: metricsFor("product") },
      commercial: {
        // Already a real string[] from TagInput (confirmed 2026-08-25) —
        // no split/join needed anymore; kept as a plain filter for the
        // same defensive reason as before (never send a blank entry).
        namedCompetitors: namedCompetitors.map((c) => c.trim()).filter(Boolean),
        marketChangeNotes: marketChangeNotes.trim() || null,
        pricingPressureNotes: pricingPressureNotes.trim() || null,
        lostDealsNotes: lostDealsNotes.trim() || null,
        metrics: commercialMetricsFor(),
      },
      aiGovernance: {
        hasLiveAiInProduction,
        governanceDocsSubmitted,
        ...(governanceDocsSubmitted
          ? {
              governanceEvidence: governanceEvidenceText.trim()
                ? [{ fieldName: "governance_documentation", fieldValue: governanceEvidenceText.trim(), source: governanceEvidenceSource, isBlank: false }]
                : [],
            }
          : { questionnaireScores: dimensionScores }),
      },
    };
  }

  async function handleConfirmSubmit() {
    setShowConfirmModal(false);
    setStatus("submitting");
    setError(null);

    // Real bug found and fixed 2026-08-15, same class already found live
    // in the three standalone modules (see TenderReadinessIntakeForm.tsx's
    // doSubmit() for the full root-cause writeup): a genuine RPC-level
    // failure — not this function's own {success:false} branch, a real
    // rejected fetch — was never caught, leaving "submitting" stuck
    // forever with no way for the client to ever see an error. This
    // specific call is the fast, store-only path (no synchronous Groq
    // call), so a timeout is less likely here than in "Submit now" below,
    // but the same defensive guarantee belongs on every submit handler,
    // not only the one already proven to hit it in production.
    try {
      const result = await submitEvidence(buildSubmitInput());

      if (result.success) {
        // Redirects to /dashboard, not /reports/[reportId] (confirmed
        // 2026-08-10, delayed-execution architecture) — submitting evidence
        // no longer creates a report at all; it only stores the evidence
        // record (see submitEvidence()'s own docblock). There's no reportId
        // to navigate to yet. Dashboard already computes journeyStatus and
        // shows the right "Editing / Queued for audit / Audit in progress"
        // state via ProgressStepper/NextStepBanner.
        router.push("/dashboard");
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  const [showSubmitNowModal, setShowSubmitNowModal] = useState(false);

  /**
   * "Submit now, I'm done editing" fast-track (confirmed 2026-08-11,
   * direct founder request) — deliberately its own button/modal/handler,
   * not a variant of the flow above: it makes a genuinely different
   * promise ("this runs right now and locks in immediately," not "you'll
   * have N hours to change your mind"), so it needs its own explicit
   * confirmation copy, not a shared one. Guarded by
   * status === "submitting-now" the same way the normal submit is guarded
   * by "submitting" — a double-click can't fire this twice from the
   * client side; the real, load-bearing guarantee against a genuine
   * double-fire (e.g. racing a concurrent cron tick) lives server-side in
   * claimPendingEvidenceSubmissionForImmediateAudit()'s atomic conditional
   * claim, not here — this is just the ordinary "don't let a slow network
   * click twice" UI guard every other submit button in this app already
   * has.
   */
  function handleSubmitNowClick() {
    if (hasInvalidMetric) return;
    setShowSubmitNowModal(true);
  }

  async function handleConfirmSubmitNow() {
    setShowSubmitNowModal(false);
    setStatus("submitting-now");
    setError(null);

    // Real bug found and fixed 2026-08-15, same class already found live
    // in production for the three standalone modules (see
    // TenderReadinessIntakeForm.tsx's doSubmit() for the full root-cause
    // writeup) — and the single highest-risk place for it in this entire
    // app: this is the one genuinely synchronous five-lens Groq call left
    // in the codebase, the exact real duration the pre-delayed-execution
    // architecture used to show a loading state for. Without this catch,
    // a real RPC-level failure (most plausibly a serverless function
    // timeout under a slow or rate-limited Groq run) would leave the
    // "Analyzing your evidence…" overlay spinning forever with no way for
    // the client to ever see an error.
    try {
      const result = await submitEvidenceNow(buildSubmitInput());

      if (result.success && result.reportId) {
        // Straight to the report's own holding page, not /dashboard — a
        // real report now exists (unlike the normal submit above), and this
        // is the one page that already correctly renders both "still being
        // reviewed" and, once approved, the real delivered content.
        router.push(`/reports/${result.reportId}`);
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
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

      {/*
       * Live countdown directly above the form (confirmed 2026-08-11,
       * countdown-copy-clarity pass) — previously the only place a client
       * saw their edit window was Dashboard/NextStepBanner, away from the
       * actual fields it applies to. Explicit language paired with the
       * timer, not a bare number, per direct founder feedback: "You have
       * 24 hours to review and change anything below" — "below" is
       * literal, this banner sits directly above the editable fields.
       * Only rendered once there's a real active submission to count down
       * (isEditingExisting + editWindowClosesAt) — a first-time visitor
       * with no submission yet has no window to show.
       */}
      {isEditingExisting && editWindowClosesAt && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 dark:border-accent/30 dark:bg-accent/10">
          <p className="text-sm text-neutral-800 dark:text-neutral-100">
            You have <EditWindowCountdown closesAt={editWindowClosesAt} /> to review and change anything below.
          </p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Come back any time before then — your changes save to this same submission, and review begins
            automatically once the window closes.
          </p>
          {/*
           * Real submission/edit dates (confirmed 2026-08-12, real bug
           * list item #4) — previously nothing on this page showed WHEN
           * evidence was first submitted or last changed, only a relative
           * countdown to the deadline. updatedAt only shown when it
           * genuinely differs from submittedAt (more than a minute apart,
           * to absorb clock/round-trip noise) — otherwise showing both
           * would just repeat the same moment twice.
           */}
          {submittedAt && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              Submitted {new Date(submittedAt).toLocaleString()}
              {updatedAt && Math.abs(new Date(updatedAt).getTime() - new Date(submittedAt).getTime()) > 60_000
                ? ` · last edited ${new Date(updatedAt).toLocaleString()}`
                : ""}
            </p>
          )}
          {/*
           * "Submit now, I'm done editing" fast-track (confirmed
           * 2026-08-11, direct founder request) — a deliberate, separate
           * option alongside the normal wait, not a replacement for it.
           * Its own confirmation modal below, not this button's onClick
           * directly, so the "you won't be able to make further changes"
           * warning is impossible to skip past accidentally.
           */}
          <button
            type="button"
            onClick={handleSubmitNowClick}
            disabled={status === "submitting-now" || hasInvalidMetric}
            className="mt-3 text-sm font-medium text-accent underline decoration-accent/50 underline-offset-2 hover:decoration-accent disabled:cursor-not-allowed disabled:opacity-50 dark:text-accent"
          >
            Submit now, I&apos;m done editing →
          </button>
          {/*
           * Real gap found and fixed during live verification (confirmed
           * 2026-08-11) — the shared error Alert further down the form (by
           * the privacy checkbox) is easy to miss when the error was
           * actually caused by THIS top-of-page button (e.g. clicking
           * "Submit now" before scrolling down to accept the privacy
           * policy). Same shared status/error state, rendered a second
           * time right where the action that could have caused it lives.
           */}
          {status === "error" && error && (
            <Alert variant="error" className="mt-3">
              {error}
            </Alert>
          )}
        </div>
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
                    error={metricError(metricValues[`${set.lens}.${m.metricKey}`]) ?? undefined}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {set.fields.map((f) => (
              <Textarea
                key={f.key}
                name={`${set.lens}.${f.key}`}
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

        {/* Key metrics (added 2026-08-25, real gap fix) — same pattern as
            the generic FIELD_SETS loop above, but hand-placed here since
            Commercial isn't part of that array (see COMMERCIAL_METRICS's
            own docblock in field-sets.ts for why). Deliberately NOT
            benchmark-compared — no fabricated thresholds, narrated
            qualitatively by the lens, same as every other Commercial
            self-report field. */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Key metrics (optional — used for your goal&apos;s trend tracking)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {COMMERCIAL_METRICS.map((m) => (
              <Input
                key={m.metricKey}
                type="number"
                step="any"
                inputMode="decimal"
                name={`commercial.${m.metricKey}`}
                label={m.unit ? `${m.label} (${m.unit})` : m.label}
                hint={m.hint}
                placeholder={m.placeholder}
                value={metricValues[`commercial.${m.metricKey}`] ?? ""}
                onChange={(e) => setMetricValues((prev) => ({ ...prev, [`commercial.${m.metricKey}`]: e.target.value }))}
                error={metricError(metricValues[`commercial.${m.metricKey}`]) ?? undefined}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Converted from a plain comma-separated text Input to the
              app's own TagInput component (confirmed 2026-08-25, for
              consistency with identical "type these one at a time" fields
              elsewhere — Business Profile's Social links/Tools stack). */}
          <TagInput
            label="Named competitors"
            placeholder="e.g. Competitor A"
            value={namedCompetitors}
            onChange={setNamedCompetitors}
          />
          {/* Real placeholder examples added (confirmed 2026-08-25, real
              gap fix) — these three were the only free-text fields on the
              whole form with no guidance at all, a jarring drop right as
              the form moved into its 4th section. `name` added on all
              three (previously absent) so Textarea's own htmlFor/id
              pairing — which already works correctly when given one — can
              actually associate the visible label with the field; this
              was a real, confirmed accessibility gap, not a Textarea
              component bug. */}
          <Textarea
            label="Market change notes"
            name="commercial.marketChangeNotes"
            rows={2}
            placeholder="e.g. A new competitor entered our segment, or a big customer segment shifted priorities."
            value={marketChangeNotes}
            onChange={(e) => setMarketChangeNotes(e.target.value)}
          />
          <Textarea
            label="Pricing pressure notes"
            name="commercial.pricingPressureNotes"
            rows={2}
            placeholder="e.g. We've had to discount more than usual to win deals against cheaper alternatives."
            value={pricingPressureNotes}
            onChange={(e) => setPricingPressureNotes(e.target.value)}
          />
          <Textarea
            label="Lost deals notes"
            name="commercial.lostDealsNotes"
            rows={2}
            placeholder="e.g. Lost 2 deals last quarter — both cited price as the reason."
            value={lostDealsNotes}
            onChange={(e) => setLostDealsNotes(e.target.value)}
          />
        </div>
      </Card>

      <Card title="AI & Governance">
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={hasLiveAiInProduction}
                onChange={(e) => setHasLiveAiInProduction(e.target.checked)}
              />
              We have live AI in production today
            </label>
            {/* Real, dedicated company-level sync (confirmed 2026-08-20,
                item 5 of the external-feedback batch) — pre-filled from
                Business Profile if already answered there; changing it
                here updates that same record on submit. */}
            <p className="ml-6 mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              Pre-filled from Business Profile — confirming or changing it here keeps that record current too.
            </p>
          </div>
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
            <div className="space-y-3">
              {/* Real document upload (confirmed 2026-08-12) — closes the
                  real gap found while investigating whether this
                  "document-review mode" actually read real documents; it
                  didn't, this textarea was description-only. Upload is
                  additive, not a replacement — a client with nothing to
                  upload can still type a description directly below. */}
              <DocumentUploadField
                label="Upload your governance documentation (optional)"
                hint="PDF or DOCX — e.g. your AI use policy, risk classification process, or incident response plan. We'll extract the text; you can review and edit it below before submitting."
                onExtracted={(text) => {
                  setGovernanceEvidenceText(text);
                  setGovernanceEvidenceSource("parsed");
                }}
              />
              <Textarea
                label="Describe your governance documentation"
                rows={4}
                placeholder="e.g. our AI use policy, risk classification process, incident response plan…"
                value={governanceEvidenceText}
                onChange={(e) => {
                  setGovernanceEvidenceText(e.target.value);
                  setGovernanceEvidenceSource("manual");
                }}
              />
            </div>
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

        <Button
          type="submit"
          disabled={status === "submitting" || status === "submitting-now" || !privacyAcknowledged || hasInvalidMetric}
        >
          {status === "submitting" ? "Submitting…" : "Submit for review"}
        </Button>
      </section>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
            <h3 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">
              {isEditingExisting ? "Save these changes?" : "Ready to submit?"}
            </h3>
            {/*
             * Rewritten 2026-08-10 for the real delayed-execution
             * architecture (direct founder request, following a real
             * architecture question about when the audit actually runs).
             * Genuinely accurate now, not honesty-patched: the audit no
             * longer runs immediately on submit, so "edit or add evidence"
             * is now literally true — resubmitting during the window
             * really does update this same record in place (see
             * pending-submission.ts), not create anything new.
             *
             * Explicit {" "} kept after every expression whose following
             * text could wrap to a new source line — a real, separate JSX
             * gotcha found and fixed 2026-08-10 (a literal space right
             * after an expression is silently dropped by JSX's whitespace
             * collapsing whenever that text node spans multiple lines),
             * not decorative.
             */}
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              {isEditingExisting ? (
                <>
                  This updates your existing submission — no new report, no re-analysis yet. You still have until{" "}
                  {editWindowHours}{" "}
                  hours from your original submission to keep making changes; review begins automatically once that
                  time is up.
                </>
              ) : (
                <>
                  You&apos;ll have {editWindowHours}{" "}
                  hours to keep editing or adding evidence — come back to this page any time before then and your
                  changes save to this same submission. After that, review begins, and your report will be ready
                  within {editWindowHours + reviewPeriodHours}{" "}
                  hours total.{" "}
                  {isFreeAudit ? "This will use your free audit." : "This is a paid re-audit."}
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowConfirmModal(false)} className="px-3 py-1.5">
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmSubmit} className="px-3 py-1.5">
                {isEditingExisting ? "Save changes" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator, rewritten 2026-08-10 for the delayed-execution
          architecture — the previous copy here described a real five-lens
          Groq run happening synchronously inside submitEvidence(), which
          was true then but is no longer accurate: submission is now just
          a fast evidence-record write (see pending-submission.ts), with
          the actual analysis deferred to a later cron tick. A "please
          don't close this tab, analysis in progress" message would now be
          actively misleading. Kept as a real, if brief, indicator rather
          than removed outright — this still moves through a real
          server round-trip, and a disabled button alone was already
          flagged as too easy to miss in the earlier bug-list pass. */}
      {status === "submitting" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg dark:bg-neutral-900">
            <div
              className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-accent dark:border-neutral-700"
              aria-hidden="true"
            />
            <h3 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">Saving your evidence…</h3>
          </div>
        </div>
      )}

      {/*
       * "Submit now" confirmation modal (confirmed 2026-08-11) —
       * deliberately separate copy from the normal "Ready to submit?"
       * modal above: that one promises N hours to change your mind, this
       * one promises the opposite. The warning is the whole point of this
       * modal existing, not boilerplate to click past.
       */}
      {showSubmitNowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
            <h3 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">Submit now?</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              This closes your edit window right now and starts the analysis immediately — you won&apos;t be able to
              make further changes after this. Make sure everything below is how you want it before continuing.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowSubmitNowModal(false)} className="px-3 py-1.5">
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmSubmitNow} className="px-3 py-1.5">
                Submit now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/*
       * A genuinely different loading state from the "submitting" overlay
       * above (confirmed 2026-08-11) — "Submit now" really does run a
       * synchronous five-lens Groq call in this same request (the same
       * real duration the pre-delayed-execution architecture used to show
       * a loading state for, before submission became a fast store-only
       * write). Reusing "Saving your evidence…" here would be actively
       * misleading in the other direction now — this one genuinely
       * shouldn't have the tab closed while it runs.
       *
       * Copy corrected 2026-08-25 (real honest-testing finding): a real
       * live run measured 91 seconds, not "under a minute" as this
       * previously promised — same class of promise-vs-reality gap
       * already documented elsewhere in this codebase for Groq call
       * timing. "A minute or two" is honest against the real observed
       * range without overcorrecting into vague hedging.
       */}
      {status === "submitting-now" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg dark:bg-neutral-900">
            <div
              className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-accent dark:border-neutral-700"
              aria-hidden="true"
            />
            <h3 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">Analyzing your evidence…</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              We&apos;re running your Financial, Execution, Product, Commercial, and AI &amp; Governance analysis. This
              usually takes a minute or two — please don&apos;t close this tab.
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
