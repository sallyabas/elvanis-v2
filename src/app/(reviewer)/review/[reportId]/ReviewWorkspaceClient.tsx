"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfidenceLevel, GoalRelevance, LensFinding, LensType, Severity } from "@/lib/lenses/types";
import { isFixFirstCandidate } from "@/lib/reviewer/prioritization";
import {
  acceptFindingAction,
  editFindingAction,
  rejectFindingAction,
  resolveConflictAction,
  resolveDisputeAction,
  reRankTop3Action,
  approveReportAction,
  deliverReportAction,
  rerunAuditAction,
  setPlanTierAction,
  startExecutionSprintAction,
  saveFindingConciergeNoteAction,
} from "./actions";
import type { DisputeResolution } from "@/lib/reviewer/workspace";
import { matchRecommendationLibraryEntries, type RecommendationLibraryEntry } from "@/lib/recommendations/recommendation-library";
import { computeCascadeSignals } from "@/lib/recommendations/cascade";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { humanizeStatus } from "@/lib/format";
import { SEVERITY_STYLES } from "@/lib/severity-badge";
import { Card } from "@/app/_components/ui/Card";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

interface FindingRow {
  id: string;
  lens: LensType;
  ai_draft: LensFinding;
  reviewer_edited_content: LensFinding | null;
  reviewer_status: "draft" | "edited" | "approved" | "rejected";
  reviewer_notes: string | null;
  confidence_level: ConfidenceLevel | null;
  is_missing_data_finding: boolean;
  origin: string | null;
  client_confidence_marking: string | null;
  is_disputed: boolean;
  dispute_resolution_notes: string | null;
}

interface ConflictRow {
  id: string;
  finding_a_id: string;
  finding_b_id: string;
  conflict_description: string;
  /** Nullable — older conflicts predate this field (confirmed 2026-08-12); always populated going forward. */
  ai_suggested_resolution: string | null;
  resolution_status: "unresolved" | "reviewer_resolved";
  reviewer_notes: string | null;
}

interface TimingInfo {
  createdAt: string;
  submittedAt: string | null;
  editWindowClosesAt: string | null;
  approvedAt: string | null;
}

/**
 * Reviewer-authored finding note (confirmed 2026-08-24, Concierge tier
 * build) — a lightweight local shape, deliberately not importing
 * FindingConciergeNote from lib/reviewer/finding-notes.ts directly, since
 * that module imports the server-only admin client at module scope and
 * has no business being pulled into a client bundle.
 */
interface ConciergeNote {
  authorName: string;
  note: string;
  updatedAt: string;
}

interface Props {
  reportId: string;
  companyName: string;
  companyUserId: string | null;
  planTier: string;
  reportStatus: string;
  /**
   * Real gap closed (confirmed 2026-09-03) — which of the 5 lenses
   * genuinely failed to run during this audit, persisted for the first
   * time (see run-audit.ts). Non-empty means the report is provably
   * incomplete, not just thin — approveReport() now hard-blocks on this
   * server-side too; the banner below just makes the reason visible
   * before the reviewer even tries.
   */
  failedLenses: string[];
  top3FindingIds: string[];
  canRerun: boolean;
  rerunOfReportId: string | null;
  similarPatterns: { companyId: string; companyName: string; reportId: string; overlappingTags: string[]; similarityScore: number }[];
  findings: FindingRow[];
  conflicts: ConflictRow[];
  timing: TimingInfo;
  /**
   * DB-backed as of 2026-08-06 (see recommendations/repository.ts) —
   * fetched server-side in page.tsx and passed down here, since
   * RECOMMENDATION_LIBRARY can no longer be imported directly into this
   * client component now that it's an async DB read. Threaded through to
   * EditForm below, same pattern as GOVERNANCE_DIMENSIONS in
   * EvidenceIntakeForm.
   */
  recommendationLibrary: RecommendationLibraryEntry[];
  /** Concierge tier build (confirmed 2026-08-24) — keyed by findingId, one query in page.tsx, not N. */
  conciergeNotesByFindingId: Record<string, ConciergeNote>;
  /** Prefills the "Your name" field when adding a note — real session lookup in page.tsx, may be blank. */
  currentReviewerName: string;
}

function displayedContent(f: FindingRow): LensFinding {
  return f.reviewer_edited_content ?? f.ai_draft;
}

// Softened 2026-08-28 (premium B2B redesign) — same restrained, no-border
// treatment as the shared SEVERITY_STYLES (@/lib/severity-badge), applied
// by extension since this workspace's own status/severity badges are the
// same conceptual pattern.
const STATUS_BADGE: Record<FindingRow["reviewer_status"], string> = {
  draft: "bg-yellow-50 text-yellow-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300",
  edited: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  rejected: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
};

// SEVERITY_BADGE replaced by the shared SEVERITY_STYLES (@/lib/severity-badge)
// — this file previously kept its own local copy with the old saturated
// tones; now reads from the single source of truth like every other page.

const LENS_LABELS: Record<LensType, string> = {
  financial: "Financial",
  commercial: "Commercial / Market",
  execution: "Execution / Operating",
  product: "Product / Customer",
  ai_governance: "AI & Governance",
};

const LENS_ORDER: LensType[] = ["financial", "commercial", "execution", "product", "ai_governance"];

/**
 * Humanizes a raw `case_library` tag (confirmed 2026-08-26, navigation-
 * audit fix batch, item 4) — real gap found live: "Similar patterns"
 * rendered these internal, machine-parseable tags verbatim (e.g.
 * `goal:growth_revenue_efficiency`, `lens:financial:severity:critical`),
 * which is exactly the format case-library.ts's own tag-building functions
 * produce (`goal:`/`industry:`/`stage:`/`lens:<key>:severity:<level>`) —
 * see that file for the source of truth these patterns match against.
 * Reuses this same file's own LENS_LABELS and the shared GOAL_LABELS
 * rather than inventing new copy.
 */
function formatOverlapTag(tag: string): string {
  const lensMatch = tag.match(/^lens:([a-z_]+):severity:([a-z]+)$/);
  if (lensMatch) {
    const [, lens, severity] = lensMatch;
    return `${LENS_LABELS[lens as LensType] ?? lens}: ${severity} severity`;
  }
  if (tag.startsWith("goal:")) {
    const goal = tag.slice("goal:".length);
    return `Goal: ${GOAL_LABELS[goal as PrimaryGoal] ?? goal}`;
  }
  if (tag.startsWith("industry:")) return `Industry: ${tag.slice("industry:".length)}`;
  if (tag.startsWith("stage:")) return `Stage: ${tag.slice("stage:".length)}`;
  return humanizeStatus(tag);
}

function formatDuration(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const ms = to - from;
  if (ms < 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function ReviewWorkspaceClient({
  reportId,
  companyName,
  companyUserId,
  planTier,
  reportStatus,
  failedLenses,
  top3FindingIds,
  canRerun,
  rerunOfReportId,
  similarPatterns,
  findings,
  conflicts,
  timing,
  recommendationLibrary,
  conciergeNotesByFindingId,
  currentReviewerName,
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [rerunResultId, setRerunResultId] = useState<string | null>(null);
  const [tierPending, setTierPending] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [startingSprintFor, setStartingSprintFor] = useState<string | null>(null);
  // Real bug found live (confirmed 2026-08-16): every action button on
  // this workspace — Accept/Edit/Reject, Approve, plan-tier, top-3
  // reordering, conflict/dispute resolution — could get stuck disabled/
  // loading forever on a genuine RPC-level failure. None of these
  // handlers had a try/catch around their await, the same uncaught-RPC-
  // failure class already found and fixed repeatedly on the CLIENT-facing
  // intake forms (Tender Readiness, AI Reliability, Data Protection,
  // Evidence Intake) but never propagated to the reviewer-side workspaces
  // — this is the biggest and most-used one, so the gap was the most
  // visible here. Handlers that already had their own dedicated error
  // state (deliverError/sprintError/rerunError) keep using it — a thrown
  // exception now lands there too, not just a resolved {success: false}.
  // Everything else shares one new actionError state.
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSetPlanTier(tier: "free" | "concierge") {
    if (!companyUserId) return;
    setTierPending(true);
    setActionError(null);
    try {
      await setPlanTierAction(reportId, companyUserId, tier);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setTierPending(false);
    }
  }

  const findingById = new Map(findings.map((f) => [f.id, f]));

  async function handleAccept(findingId: string) {
    setPending(true);
    setActionError(null);
    try {
      await acceptFindingAction(reportId, findingId);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleReject(findingId: string) {
    setPending(true);
    setActionError(null);
    try {
      await rejectFindingAction(reportId, findingId);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit(f: FindingRow, changes: EditFormValues, notes: string) {
    setPending(true);
    setActionError(null);
    try {
      await editFindingAction(reportId, f.id, displayedContent(f), changes, notes || undefined);
      setEditingId(null);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleResolveDispute(f: FindingRow, resolution: DisputeResolution, notes: string, changes?: EditFormValues) {
    setPending(true);
    setActionError(null);
    try {
      await resolveDisputeAction(reportId, f.id, resolution, notes, displayedContent(f), resolution === "edit" ? changes : undefined);
      setDisputingId(null);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleResolveConflict(conflictId: string, notes: string) {
    setPending(true);
    setActionError(null);
    try {
      await resolveConflictAction(reportId, conflictId, notes);
      setResolvingConflictId(null);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleMoveTop3(index: number, direction: -1 | 1) {
    const next = [...top3FindingIds];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setPending(true);
    setActionError(null);
    try {
      await reRankTop3Action(reportId, next);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handlePromoteToTop3(findingId: string) {
    setPending(true);
    setActionError(null);
    try {
      await reRankTop3Action(reportId, [findingId, ...top3FindingIds.filter((id) => id !== findingId)]);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleApprove() {
    setPending(true);
    setActionError(null);
    try {
      const result = await approveReportAction(reportId);
      setBlockedReason(result.approved ? null : (result.blockedReason ?? "Blocked"));
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  /**
   * Real "Deliver" button (confirmed 2026-08-06) — see actions.ts docblock.
   * deliverReport() itself refuses anything not already status='approved',
   * so this button is disabled ahead of that too, but the server-side
   * check is still the real gate, not this disabled attribute.
   */
  async function handleDeliver() {
    setPending(true);
    setDeliverError(null);
    try {
      const result = await deliverReportAction(reportId);
      if (result.success) {
        setDelivered(true);
      } else {
        setDeliverError(result.error ?? "Something went wrong.");
      }
    } catch {
      setDeliverError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  /**
   * Execution Sprint entry point (confirmed 2026-08-06, split into a real
   * client-confirmation step 2026-08-18) — proposes the sprint to the
   * client rather than immediately drafting tasks; the reviewer's
   * Accept/Edit/Reject pass only becomes available once the client has
   * confirmed (or reselected) which finding it should address. Only ever
   * offered for approved/edited findings, matching proposeSprintFinding()'s
   * own server-side guard.
   */
  async function handleStartSprint(findingId: string) {
    setStartingSprintFor(findingId);
    setSprintError(null);
    try {
      const result = await startExecutionSprintAction(reportId, findingId);
      if (result.success) {
        // Deliberately NOT resetting startingSprintFor here — the button
        // stays showing "Proposing…" through the navigation transition,
        // same as before this fix. Only the failure paths (below and in
        // catch) reset it, since those are the only cases where the
        // reviewer stays on this page and needs the button clickable
        // again.
        router.push(`/review-sprint/${result.sprintId}`);
        return;
      }
      setSprintError(result.error ?? "Something went wrong.");
      setStartingSprintFor(null);
    } catch {
      setSprintError("Something went wrong reaching the server — please try again.");
      setStartingSprintFor(null);
    }
  }

  async function handleRerun() {
    setPending(true);
    setRerunError(null);
    try {
      const result = await rerunAuditAction(reportId);
      if (result.success) {
        setRerunResultId(result.newReportId ?? null);
      } else {
        setRerunError(result.error ?? "Something went wrong.");
      }
    } catch {
      setRerunError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  const undisputedFindings = findings.filter((f) => !f.is_disputed);
  const disputedFindings = findings.filter((f) => f.is_disputed);
  const draftFindings = findings.filter((f) => f.reviewer_status === "draft");
  const unresolvedConflicts = conflicts.filter((c) => c.resolution_status === "unresolved");

  // Signal cascades (confirmed 2026-08-13, item 1 of the old-Elvanis-
  // inspired batch) — computed against every non-rejected finding on this
  // report, so a finding's cascade count reflects the real, currently-live
  // finding set the reviewer is actually looking at (a rejected finding
  // shouldn't count toward "upstream of N others," since it's been
  // dropped from the client-facing picture).
  const cascadeSignals = computeCascadeSignals(
    findings.filter((f) => f.reviewer_status !== "rejected").map((f) => ({ id: f.id, lens: f.lens, ...displayedContent(f) })),
    recommendationLibrary,
  );

  const fixFirstCandidates = findings.filter(
    (f) =>
      f.reviewer_status !== "rejected" &&
      !top3FindingIds.includes(f.id) &&
      isFixFirstCandidate(displayedContent(f), cascadeSignals.get(f.id)?.cascadeCount ?? 0),
  );

  const fullCycle = formatDuration(timing.submittedAt, timing.approvedAt);
  const reviewerOnly = formatDuration(timing.editWindowClosesAt, timing.approvedAt);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            planTier === "concierge"
              ? "bg-[#fdf6ee] text-accent dark:bg-neutral-800 dark:text-accent"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          }`}
        >
          {planTier === "concierge" ? "Concierge" : "Standard"}
        </span>
        {companyUserId && (
          <select
            className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-900 shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            value={planTier}
            disabled={tierPending}
            onChange={(e) => handleSetPlanTier(e.target.value as "free" | "concierge")}
          >
            <option value="free">Standard</option>
            <option value="concierge">Concierge</option>
          </select>
        )}
      </div>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        Report status: <span className="font-medium">{reportStatus}</span>
      </p>

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {(fullCycle || reviewerOnly) && (
        <p className="mb-6 text-xs text-neutral-500 dark:text-neutral-400">
          {reviewerOnly && (
            <>
              Reviewer time (queue → {timing.approvedAt ? "approval" : "now"}): <span className="font-medium">{reviewerOnly}</span>
              {" · "}
            </>
          )}
          {fullCycle && (
            <>
              Full audit cycle (submission → {timing.approvedAt ? "approval" : "now"}): <span className="font-medium">{fullCycle}</span>
            </>
          )}
        </p>
      )}

      {/* Real gap closed (confirmed 2026-09-03, direct founder decision
          following a full investigation into Groq failure handling) —
          the mandatory-decision banner below covers "findings exist but
          aren't decided yet"; it had nothing to say about "this audit is
          missing entire lenses" or "this audit produced nothing at all,"
          both of which previously passed the approval gate silently. Two
          distinct treatments, per the confirmed design: a failed lens is
          a HARD block (server-side too, see approveReport()) since the
          report is provably incomplete — no override, only "Re-run
          analysis" below. Zero findings with no lens failure is a real,
          reachable state (confirmed: no lens schema requires at least one
          finding, and none has a deterministic fallback forcing one) but
          not necessarily wrong — a genuinely clean audit is possible — so
          it's a visible warning only; Approve stays enabled and the
          reviewer's own judgment decides. */}
      {failedLenses.length > 0 && (
        <section className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-card-1 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">
            {failedLenses.length} lens{failedLenses.length === 1 ? "" : "es"} failed to generate during this audit:{" "}
            {failedLenses.map((l) => LENS_LABELS[l as LensType] ?? l).join(", ")}.
          </p>
          <p className="mt-1">
            This report is genuinely incomplete, not just thin — approval is blocked. Re-run the analysis below rather than deliver a report
            missing whole sections with no disclosure.
          </p>
        </section>
      )}

      {failedLenses.length === 0 && findings.length === 0 && (
        <Alert variant="warning" className="mb-6">
          No findings were generated — all lenses ran successfully. Confirm this is genuinely correct before approving.
        </Alert>
      )}

      {(draftFindings.length > 0 || unresolvedConflicts.length > 0) && (
        <section className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-card-1 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Mandatory before this report can be approved:</p>
          <ul className="mt-1 list-inside list-disc">
            {draftFindings.length > 0 && (
              <li>{draftFindings.length} finding(s) still need a decision — Accept, Edit, or Reject each one below.</li>
            )}
            {unresolvedConflicts.length > 0 && <li>{unresolvedConflicts.length} flagged conflict(s) still unresolved.</li>}
          </ul>
        </section>
      )}

      {top3FindingIds.length > 0 && (
        <Card title="Top 3 priorities" className="mb-8">
          <ol className="space-y-2">
            {top3FindingIds.map((id, i) => {
              const f = findingById.get(id);
              return (
                <li key={id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                  <span>
                    {i + 1}. {f ? displayedContent(f).title : id}
                  </span>
                  <span className="flex gap-1">
                    <button
                      disabled={pending || i === 0}
                      onClick={() => handleMoveTop3(i, -1)}
                      className="rounded-md border border-neutral-300 px-2 py-0.5 hover:bg-neutral-50 disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      ↑
                    </button>
                    <button
                      disabled={pending || i === top3FindingIds.length - 1}
                      onClick={() => handleMoveTop3(i, 1)}
                      className="rounded-md border border-neutral-300 px-2 py-0.5 hover:bg-neutral-50 disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {fixFirstCandidates.length > 0 && (
        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 shadow-card-1 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">Suggested fix-first (not yet in top 3)</h2>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Deterministically flagged: critical severity, high severity directly tied to the client&apos;s stated goal, or upstream of 2+ other findings
            on this report (see below). A suggestion only — promote manually if it belongs in the top 3.
          </p>
          <ul className="space-y-2">
            {fixFirstCandidates.map((f) => {
              const cascade = cascadeSignals.get(f.id);
              return (
                <li key={f.id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                  <span>
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLES[displayedContent(f).severity]}`}>
                      {displayedContent(f).severity}
                    </span>
                    {displayedContent(f).title}
                    {cascade && cascade.cascadeCount >= 2 && (
                      <span className="ml-2 text-xs text-accent" title={cascade.cascadesToFindingTitles.join(", ")}>
                        upstream of {cascade.cascadeCount} other finding{cascade.cascadeCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                  {f.reviewer_status === "draft" ? (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">decide this finding first</span>
                  ) : (
                    <Button variant="secondary" disabled={pending} onClick={() => handlePromoteToTop3(f.id)} className="px-2 py-0.5 text-xs">
                      Add to top 3
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {conflicts.length > 0 && (
        <section className="mb-8 rounded-lg bg-orange-50 p-5 shadow-card-1 dark:bg-orange-950">
          <h2 className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">Flagged conflicts</h2>
          <ul className="space-y-4">
            {conflicts.map((c) => {
              const a = findingById.get(c.finding_a_id);
              const b = findingById.get(c.finding_b_id);
              return (
                <li key={c.id} className="text-sm">
                  <p className="mb-1 text-neutral-900 dark:text-neutral-50">
                    <strong>{a ? displayedContent(a).title : c.finding_a_id}</strong> vs.{" "}
                    <strong>{b ? displayedContent(b).title : c.finding_b_id}</strong>
                  </p>
                  <p className="mb-2 text-neutral-600 dark:text-neutral-400">{c.conflict_description}</p>
                  {/*
                   * AI-suggested resolution (confirmed 2026-08-12, direct
                   * founder request) — shown as its own distinct box, not
                   * folded into conflict_description, so it's visually
                   * clear this is a suggestion to evaluate, not a
                   * statement of fact the way the conflict description
                   * itself is. Reviewer still has final say — this only
                   * prefills the resolution form below, it doesn't
                   * resolve anything by itself.
                   */}
                  {c.ai_suggested_resolution && c.resolution_status === "unresolved" && (
                    <p className="mb-2 rounded-md border-l-2 border-orange-400 bg-white px-2 py-1.5 text-xs text-neutral-700 shadow-card-1 dark:border-orange-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <span className="font-semibold text-orange-700 dark:text-orange-400">Suggested resolution: </span>
                      {c.ai_suggested_resolution}
                    </p>
                  )}
                  {c.resolution_status === "reviewer_resolved" ? (
                    <p className="text-xs text-green-700 dark:text-green-400">Resolved: {c.reviewer_notes}</p>
                  ) : resolvingConflictId === c.id ? (
                    <ConflictResolutionForm
                      initialNotes={c.ai_suggested_resolution ?? ""}
                      onCancel={() => setResolvingConflictId(null)}
                      onSave={(notes) => handleResolveConflict(c.id, notes)}
                    />
                  ) : (
                    <Button variant="secondary" onClick={() => setResolvingConflictId(c.id)} className="px-2 py-1 text-xs">
                      Resolve Conflict
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {disputedFindings.length > 0 && (
        <section className="mb-8 rounded-lg bg-neutral-100 p-5 shadow-card-1 dark:bg-neutral-800">
          <h2 className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">Disputed findings (client marked not confident)</h2>
          <ul className="space-y-4">
            {disputedFindings.map((f) => (
              <li key={f.id}>
                <FindingCard f={f} />
                <ConciergeNoteEditor
                  reportId={reportId}
                  findingId={f.id}
                  existingNote={conciergeNotesByFindingId[f.id]}
                  defaultAuthorName={currentReviewerName}
                />
                {f.dispute_resolution_notes ? (
                  <p className="mt-2 text-xs text-green-700 dark:text-green-400">Resolved: {f.dispute_resolution_notes}</p>
                ) : disputingId === f.id ? (
                  <DisputeResolutionForm
                    initial={displayedContent(f)}
                    onCancel={() => setDisputingId(null)}
                    onSave={(resolution, notes, changes) => handleResolveDispute(f, resolution, notes, changes)}
                  />
                ) : (
                  <Button variant="secondary" onClick={() => setDisputingId(f.id)} className="mt-2 px-2 py-1 text-xs">
                    Resolve Dispute
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {LENS_ORDER.filter((lens) => undisputedFindings.some((f) => f.lens === lens)).map((lens) => (
        <Card key={lens} title={LENS_LABELS[lens]} className="mb-8">
          <ul className="space-y-4">
            {undisputedFindings
              .filter((f) => f.lens === lens)
              .map((f) => (
                <li key={f.id}>
                  <FindingCard f={f} />
                  <ConciergeNoteEditor
                    reportId={reportId}
                    findingId={f.id}
                    existingNote={conciergeNotesByFindingId[f.id]}
                    defaultAuthorName={currentReviewerName}
                  />
                  {editingId === f.id ? (
                    <EditForm
                      lens={f.lens}
                      initial={displayedContent(f)}
                      recommendationLibrary={recommendationLibrary}
                      onCancel={() => setEditingId(null)}
                      onSave={(changes, notes) => handleSaveEdit(f, changes, notes)}
                    />
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" disabled={pending} onClick={() => handleAccept(f.id)} className="px-2 py-1 text-xs">
                        Accept
                      </Button>
                      <Button variant="secondary" disabled={pending} onClick={() => setEditingId(f.id)} className="px-2 py-1 text-xs">
                        Edit
                      </Button>
                      <Button variant="secondary" disabled={pending} onClick={() => handleReject(f.id)} className="px-2 py-1 text-xs">
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </Card>
      ))}

      <Card>
        {blockedReason && (
          <Alert variant="warning" className="mb-3">
            {blockedReason}
          </Alert>
        )}
        <Button disabled={pending || reportStatus !== "pending_review"} onClick={handleApprove}>
          Approve report
        </Button>
      </Card>

      {/* Real "Deliver" button (confirmed 2026-08-06) — closes the gap flagged across multiple end-to-end passes where deliverReport() had no UI caller. */}
      <Card title="Deliver to client" className="mt-6">
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Makes the report visible to the client and logs a real &quot;report ready&quot; notification. Separate from Approve on
          purpose — the report is reviewer-done but not yet client-visible until this step.
        </p>
        {deliverError && (
          <Alert variant="error" className="mb-3">
            {deliverError}
          </Alert>
        )}
        {delivered || reportStatus === "sent" ? (
          <p className="text-sm text-green-700 dark:text-green-400">Delivered — the client can now see this report.</p>
        ) : (
          <Button disabled={pending || reportStatus !== "approved"} onClick={handleDeliver}>
            Deliver report
          </Button>
        )}
      </Card>

      {/* Execution Sprint entry point (confirmed 2026-08-06, split into a
          real client-confirmation step 2026-08-18 — direct founder
          question, "does the client see any confirmation before a sprint
          formally begins?" confirmed no, closed the gap) —
          reviewer-triggered from an approved/edited finding, no in-app
          checkout (payment confirmed externally first). */}
      {(reportStatus === "approved" || reportStatus === "sent") && (
        <Card title="Propose an Execution Sprint" className="mt-6">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            A bounded 2-4 week paid implementation engagement fixing ONE finding below — only once payment is
            confirmed outside the app. Proposes the sprint to the client for confirmation first — once they confirm
            (or pick a different finding they&apos;d previously marked &quot;interested in help&quot; on), you&apos;ll
            land on a review pass before the client ever sees the actual task plan.
          </p>
          {sprintError && (
            <Alert variant="error" className="mb-3">
              {sprintError}
            </Alert>
          )}
          <ul className="space-y-2">
            {undisputedFindings
              .filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited")
              .map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                  <span>{displayedContent(f).title}</span>
                  <Button
                    variant="secondary"
                    disabled={pending || startingSprintFor !== null}
                    onClick={() => handleStartSprint(f.id)}
                    className="shrink-0 px-2 py-1 text-xs"
                  >
                    {startingSprintFor === f.id ? "Proposing…" : "Propose Execution Sprint"}
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {/* Basic re-run/refresh button (confirmed 2026-08-05) — reviewer-triggered, see rerun-audit.ts for why. */}
      <Card title="Re-run analysis" className="mt-6">
        {rerunOfReportId && (
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
            This report is itself a re-run of{" "}
            <a href={`/review/${rerunOfReportId}`} className="font-medium text-accent hover:underline">
              an earlier report
            </a>
            .
          </p>
        )}
        {canRerun ? (
          <>
            <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
              Re-executes all five lenses fresh against the same evidence, using the company&apos;s current profile. Produces a new report in pending review — the mandatory review gate applies to it exactly as it does to this one.
            </p>
            {rerunError && (
              <Alert variant="error" className="mb-3">
                {rerunError}
              </Alert>
            )}
            {rerunResultId ? (
              <p className="text-sm text-green-700 dark:text-green-400">
                New report created —{" "}
                <a href={`/review/${rerunResultId}`} className="font-medium text-accent hover:underline">
                  open it
                </a>
                .
              </p>
            ) : (
              <Button variant="secondary" disabled={pending} onClick={handleRerun}>
                Re-run analysis
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            This report predates evidence-snapshot support and can&apos;t be re-run — no stored evidence to re-run against.
          </p>
        )}
      </Card>

      {/* Dormant similar-patterns infrastructure, surfaced 2026-08-06 — genuinely empty until real case volume exists (see case-library.ts). Reviewer-only, never client-facing. */}
      <Card title="Similar patterns across other companies" className="mt-6">
        {similarPatterns.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Not enough real case volume yet — this only surfaces once at least 3 genuinely distinct other companies
            show real overlap, so it doesn&apos;t show a coincidental one-off match as if it were a pattern.
          </p>
        ) : (
          <ul className="space-y-2">
            {similarPatterns.map((p) => (
              <li key={p.reportId} className="text-sm text-neutral-800 dark:text-neutral-200">
                <span className="font-medium">{p.companyName}</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  · {(p.similarityScore * 100).toFixed(0)}% overlap · {p.overlappingTags.map(formatOverlapTag).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FindingCard({ f }: { f: FindingRow }) {
  const content = displayedContent(f);
  const isDraft = f.reviewer_status === "draft";
  return (
    <div
      className={`rounded-md border bg-white p-3 shadow-card-1 dark:bg-neutral-900 ${isDraft ? "border-amber-300 dark:border-amber-800" : "border-neutral-200 dark:border-neutral-700"}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className={`rounded-full px-2 py-0.5 ${SEVERITY_STYLES[content.severity]}`}>{content.severity}</span>
        {f.origin && <span>· {f.origin}</span>}
        <span>· confidence: {content.confidenceLevel}</span>
        <span className={`rounded-full px-2 py-0.5 ${STATUS_BADGE[f.reviewer_status]}`}>{isDraft ? "needs decision" : f.reviewer_status}</span>
      </div>
      <div className="font-medium text-neutral-900 dark:text-neutral-50">{content.title}</div>
      <dl className="mt-2 space-y-1 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Diagnosis</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.diagnosis}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Root cause</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.rootCause}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Recommended action</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.recommendedAction}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Reviewer-authored finding note (confirmed 2026-08-24, Concierge tier
 * build) — genuinely new, not reused from an existing pattern. Separate
 * from FindingCard's AI-drafted diagnosis/rootCause/recommendedAction
 * above: real, personal context from an actual Discovery/Delivery call
 * that never makes it into the automated findings. One active note per
 * finding, upsert-on-save (see finding-notes.ts's own docblock) — saving
 * an empty textarea clears the note rather than needing a separate
 * delete action. Self-contained, same "own local state, revalidatePath
 * inside the Server Action does the real refresh" pattern as EditForm/
 * DisputeResolutionForm elsewhere in this file.
 */
function ConciergeNoteEditor({
  reportId,
  findingId,
  existingNote,
  defaultAuthorName,
}: {
  reportId: string;
  findingId: string;
  existingNote: ConciergeNote | undefined;
  defaultAuthorName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [authorName, setAuthorName] = useState(existingNote?.authorName ?? defaultAuthorName);
  const [noteText, setNoteText] = useState(existingNote?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveFindingConciergeNoteAction(reportId, findingId, authorName, noteText);
      setEditing(false);
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setAuthorName(existingNote?.authorName ?? defaultAuthorName);
    setNoteText(existingNote?.note ?? "");
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return existingNote ? (
      <div className="mt-2 rounded-md border-l-2 border-accent bg-[#fffbf0] p-3 text-sm dark:border-accent dark:bg-accent/10">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Concierge note — {existingNote.authorName}</p>
        <p className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">{existingNote.note}</p>
        <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400">
          Edit note
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 text-xs text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400"
      >
        + Add Concierge note
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border-l-2 border-accent bg-[#fffbf0] p-3 dark:border-accent dark:bg-accent/10">
      <Input label="Your name" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
      <Textarea
        label="Note"
        rows={3}
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Real context from your Discovery/Delivery call that doesn't fit the automated finding — clear the box and save to remove."
      />
      {error && (
        <Alert variant="error" className="py-2 text-xs">
          {error}
        </Alert>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save note"}
        </Button>
      </div>
    </div>
  );
}

interface EditFormValues {
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: Severity;
  confidenceLevel: ConfidenceLevel;
  goalRelevance: GoalRelevance;
}

function EditForm({
  lens,
  initial,
  recommendationLibrary,
  onCancel,
  onSave,
}: {
  lens: LensType;
  initial: LensFinding;
  recommendationLibrary: RecommendationLibraryEntry[];
  onCancel: () => void;
  onSave: (changes: EditFormValues, notes: string) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [diagnosis, setDiagnosis] = useState(initial.diagnosis);
  const [rootCause, setRootCause] = useState(initial.rootCause);
  const [recommendedAction, setRecommendedAction] = useState(initial.recommendedAction);
  const [severity, setSeverity] = useState<Severity>(initial.severity);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>(initial.confidenceLevel);
  const [goalRelevance, setGoalRelevance] = useState<GoalRelevance>(initial.goalRelevance);
  const [notes, setNotes] = useState("");

  // Recommendation library, seed version (confirmed 2026-08-06) — a
  // deterministic keyword match against this finding's title + diagnosis,
  // computed fresh each render from current field values (not a stale
  // computation from initial load) so it stays relevant as the reviewer
  // edits. Reference only — never auto-fills recommendedAction, the
  // reviewer decides whether/how to draw on it.
  const suggestions = matchRecommendationLibraryEntries(recommendationLibrary, lens, title, diagnosis);

  return (
    <div className="mt-2 space-y-3 rounded-md border-l-2 border-neutral-400 bg-white p-3 shadow-card-1 dark:border-neutral-600 dark:bg-neutral-900">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} />
      <Textarea label="Root cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} />
      <Textarea label="Recommended action" value={recommendedAction} onChange={(e) => setRecommendedAction(e.target.value)} rows={2} />
      {suggestions.length > 0 && (
        <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <p className="mb-1 font-medium text-neutral-500 dark:text-neutral-400">
            Suggested playbook (reference only — not auto-applied):
          </p>
          {suggestions.slice(0, 2).map((s) => (
            <div key={s.key} className="mb-1.5 last:mb-0">
              <p className="font-medium text-neutral-600 dark:text-neutral-300">{s.label}</p>
              <p className="text-neutral-500 dark:text-neutral-400">{s.recommendedActionTemplate}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="text-xs">
          {(["critical", "high", "medium", "low"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={confidenceLevel} onChange={(e) => setConfidenceLevel(e.target.value as ConfidenceLevel)} className="text-xs">
          {(["high", "medium", "low", "insufficient"] as const).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={goalRelevance} onChange={(e) => setGoalRelevance(e.target.value as GoalRelevance)} className="text-xs">
          {(["directly_blocks", "directly_affects", "directly_supports", "indirectly_affects", "unrelated"] as const).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>
      <Input placeholder="Reviewer notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={() => onSave({ title, diagnosis, rootCause, recommendedAction, severity, confidenceLevel, goalRelevance }, notes)}>
          Save edit
        </Button>
      </div>
    </div>
  );
}

function DisputeResolutionForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: LensFinding;
  onCancel: () => void;
  onSave: (resolution: DisputeResolution, notes: string, changes?: EditFormValues) => void;
}) {
  const [resolution, setResolution] = useState<DisputeResolution>("keep_ai_version");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState(initial.title);
  const [diagnosis, setDiagnosis] = useState(initial.diagnosis);
  const [rootCause, setRootCause] = useState(initial.rootCause);
  const [recommendedAction, setRecommendedAction] = useState(initial.recommendedAction);
  const [severity, setSeverity] = useState<Severity>(initial.severity);

  return (
    <div className="mt-2 space-y-3 rounded-md border-l-2 border-neutral-400 bg-white p-3 shadow-card-1 dark:border-neutral-600 dark:bg-neutral-900">
      <div className="flex gap-3 text-xs text-neutral-800 dark:text-neutral-200">
        {(["keep_ai_version", "side_with_client", "edit"] as const).map((r) => (
          <label key={r} className="flex items-center gap-1">
            <input type="radio" name="resolution" checked={resolution === r} onChange={() => setResolution(r)} className="accent-accent" />
            {r.replaceAll("_", " ")}
          </label>
        ))}
      </div>
      {resolution === "edit" && (
        <>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} />
          <Textarea placeholder="Root cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} />
          <Textarea placeholder="Recommended action" value={recommendedAction} onChange={(e) => setRecommendedAction(e.target.value)} rows={2} />
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="text-xs">
            {(["critical", "high", "medium", "low"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </>
      )}
      <Input placeholder="Resolution reasoning (required)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!notes.trim()}
          className="bg-accent px-2 py-1 text-xs text-white hover:bg-accent-hover"
          onClick={() =>
            onSave(
              resolution,
              notes,
              resolution === "edit"
                ? { title, diagnosis, rootCause, recommendedAction, severity, confidenceLevel: initial.confidenceLevel, goalRelevance: initial.goalRelevance }
                : undefined,
            )
          }
        >
          Save resolution
        </Button>
      </div>
    </div>
  );
}

/**
 * Prefilled with the AI-suggested resolution when one exists (confirmed
 * 2026-08-12) — same "AI drafts, reviewer edits or accepts as-is" pattern
 * as every EditForm in this app. An empty initialNotes (older conflicts,
 * or none was ever generated) falls back to the original blank-field
 * behavior, unchanged.
 */
function ConflictResolutionForm({
  initialNotes = "",
  onCancel,
  onSave,
}: {
  initialNotes?: string;
  onCancel: () => void;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  return (
    <div className="space-y-2">
      <Input placeholder="Which finding wins, or a merged explanation (required)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!notes.trim()} className="bg-orange-600 px-2 py-1 text-xs text-white hover:bg-orange-700" onClick={() => onSave(notes)}>
          Save resolution
        </Button>
      </div>
    </div>
  );
}
