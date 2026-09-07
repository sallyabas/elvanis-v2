"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "./actions";
import type { DisputeResolution } from "@/lib/reviewer/workspace";
import { computeCascadeSignals } from "@/lib/recommendations/cascade";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { AuditIntegrityWarnings } from "./AuditIntegrityWarnings";
import { MandatoryDecisionBanner } from "./MandatoryDecisionBanner";
import { Top3PrioritiesSection } from "./Top3PrioritiesSection";
import { FixFirstSuggestionsSection } from "./FixFirstSuggestionsSection";
import { FlaggedConflictsSection } from "./FlaggedConflictsSection";
import { DisputedFindingsSection } from "./DisputedFindingsSection";
import { LensFindingGroups } from "./LensFindingGroups";
import { ApproveDeliverSection } from "./ApproveDeliverSection";
import { ExecutionSprintProposalSection } from "./ExecutionSprintProposalSection";
import { RerunAnalysisSection } from "./RerunAnalysisSection";
import { SimilarPatternsSection } from "./SimilarPatternsSection";
import { type EditFormValues, type FindingRow, type Props, displayedContent } from "./types";

/**
 * Decomposed 2026-09-07 (confirmed plan, full test-suite stabilization
 * gate) — was a single 1567-line file (types, 7 sub-components, and one
 * ~500-line JSX return, all in one place). Now: types.ts (shared
 * shapes/labels/pure helpers), 7 sub-components in their own files
 * (FindingCard, ConciergeNoteEditor, SecondOpinionPanel,
 * ReportSecondOpinionPanel, EditForm, DisputeResolutionForm,
 * ConflictResolutionForm), 12 new section components (one per visually/
 * logically distinct block of the original JSX), and this orchestrator —
 * state, the 12 handlers, and composition only.
 *
 * `pending` state, confirmed kept lifted here and threaded down to every
 * section that needs it (Option A, direct founder decision) — preserves
 * the exact original behavior (any one action in flight disables every
 * other action-triggering button on the page simultaneously), not the
 * alternative of each section managing its own local pending state
 * (which would be a real, unasked-for behavior change letting multiple
 * actions run concurrently).
 */
export function ReviewWorkspaceClient({
  reportId,
  companyName,
  companyUserId,
  planTier,
  reportStatus,
  failedLenses,
  regulatoryStalenessWarnings,
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
  secondOpinionsByFindingId,
  reportSecondOpinion: initialReportSecondOpinion,
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <WorkspaceHeader
        companyName={companyName}
        planTier={planTier}
        companyUserId={companyUserId}
        tierPending={tierPending}
        onSetPlanTier={handleSetPlanTier}
        reportStatus={reportStatus}
        actionError={actionError}
        timing={timing}
      />

      <AuditIntegrityWarnings failedLenses={failedLenses} hasNoFindings={findings.length === 0} regulatoryStalenessWarnings={regulatoryStalenessWarnings} />

      <MandatoryDecisionBanner draftFindingsCount={draftFindings.length} unresolvedConflictsCount={unresolvedConflicts.length} />

      <Top3PrioritiesSection
        top3FindingIds={top3FindingIds}
        findingById={findingById}
        pending={pending}
        onMoveTop3={handleMoveTop3}
        reportId={reportId}
        initialReportSecondOpinion={initialReportSecondOpinion}
      />

      <FixFirstSuggestionsSection
        fixFirstCandidates={fixFirstCandidates}
        cascadeSignals={cascadeSignals}
        pending={pending}
        onPromoteToTop3={handlePromoteToTop3}
      />

      <FlaggedConflictsSection
        conflicts={conflicts}
        findingById={findingById}
        resolvingConflictId={resolvingConflictId}
        onStartResolving={setResolvingConflictId}
        onCancelResolving={() => setResolvingConflictId(null)}
        onResolveConflict={handleResolveConflict}
      />

      <DisputedFindingsSection
        disputedFindings={disputedFindings}
        reportId={reportId}
        conciergeNotesByFindingId={conciergeNotesByFindingId}
        currentReviewerName={currentReviewerName}
        disputingId={disputingId}
        onStartDisputing={setDisputingId}
        onCancelDisputing={() => setDisputingId(null)}
        onResolveDispute={handleResolveDispute}
      />

      <LensFindingGroups
        undisputedFindings={undisputedFindings}
        editingId={editingId}
        onStartEditing={setEditingId}
        onCancelEditing={() => setEditingId(null)}
        onSaveEdit={handleSaveEdit}
        onAccept={handleAccept}
        onReject={handleReject}
        recommendationLibrary={recommendationLibrary}
        reportId={reportId}
        conciergeNotesByFindingId={conciergeNotesByFindingId}
        currentReviewerName={currentReviewerName}
        secondOpinionsByFindingId={secondOpinionsByFindingId}
        pending={pending}
      />

      <ApproveDeliverSection
        blockedReason={blockedReason}
        pending={pending}
        reportStatus={reportStatus}
        onApprove={handleApprove}
        deliverError={deliverError}
        delivered={delivered}
        onDeliver={handleDeliver}
      />

      <ExecutionSprintProposalSection
        reportStatus={reportStatus}
        sprintError={sprintError}
        undisputedFindings={undisputedFindings}
        pending={pending}
        startingSprintFor={startingSprintFor}
        onStartSprint={handleStartSprint}
      />

      <RerunAnalysisSection
        rerunOfReportId={rerunOfReportId}
        canRerun={canRerun}
        rerunError={rerunError}
        rerunResultId={rerunResultId}
        pending={pending}
        onRerun={handleRerun}
      />

      <SimilarPatternsSection similarPatterns={similarPatterns} />
    </div>
  );
}
