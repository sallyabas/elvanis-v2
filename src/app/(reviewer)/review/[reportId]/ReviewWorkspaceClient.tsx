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
} from "./actions";
import type { DisputeResolution } from "@/lib/reviewer/workspace";
import { matchRecommendationLibraryEntries, type RecommendationLibraryEntry } from "@/lib/recommendations/recommendation-library";
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

interface Props {
  reportId: string;
  companyName: string;
  companyUserId: string | null;
  planTier: string;
  reportStatus: string;
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
}

function displayedContent(f: FindingRow): LensFinding {
  return f.reviewer_edited_content ?? f.ai_draft;
}

const STATUS_BADGE: Record<FindingRow["reviewer_status"], string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  edited: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

const LENS_LABELS: Record<LensType, string> = {
  financial: "Financial",
  commercial: "Commercial / Market",
  execution: "Execution / Operating",
  product: "Product / Customer",
  ai_governance: "AI & Governance",
};

const LENS_ORDER: LensType[] = ["financial", "commercial", "execution", "product", "ai_governance"];

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
  top3FindingIds,
  canRerun,
  rerunOfReportId,
  similarPatterns,
  findings,
  conflicts,
  timing,
  recommendationLibrary,
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

  async function handleSetPlanTier(tier: "free" | "concierge") {
    if (!companyUserId) return;
    setTierPending(true);
    await setPlanTierAction(reportId, companyUserId, tier);
    setTierPending(false);
  }

  const findingById = new Map(findings.map((f) => [f.id, f]));

  async function handleAccept(findingId: string) {
    setPending(true);
    await acceptFindingAction(reportId, findingId);
    setPending(false);
  }

  async function handleReject(findingId: string) {
    setPending(true);
    await rejectFindingAction(reportId, findingId);
    setPending(false);
  }

  async function handleSaveEdit(f: FindingRow, changes: EditFormValues, notes: string) {
    setPending(true);
    await editFindingAction(reportId, f.id, displayedContent(f), changes, notes || undefined);
    setEditingId(null);
    setPending(false);
  }

  async function handleResolveDispute(f: FindingRow, resolution: DisputeResolution, notes: string, changes?: EditFormValues) {
    setPending(true);
    await resolveDisputeAction(reportId, f.id, resolution, notes, displayedContent(f), resolution === "edit" ? changes : undefined);
    setDisputingId(null);
    setPending(false);
  }

  async function handleResolveConflict(conflictId: string, notes: string) {
    setPending(true);
    await resolveConflictAction(reportId, conflictId, notes);
    setResolvingConflictId(null);
    setPending(false);
  }

  async function handleMoveTop3(index: number, direction: -1 | 1) {
    const next = [...top3FindingIds];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setPending(true);
    await reRankTop3Action(reportId, next);
    setPending(false);
  }

  async function handlePromoteToTop3(findingId: string) {
    setPending(true);
    await reRankTop3Action(reportId, [findingId, ...top3FindingIds.filter((id) => id !== findingId)]);
    setPending(false);
  }

  async function handleApprove() {
    setPending(true);
    const result = await approveReportAction(reportId);
    setBlockedReason(result.approved ? null : (result.blockedReason ?? "Blocked"));
    setPending(false);
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
    const result = await deliverReportAction(reportId);
    if (result.success) {
      setDelivered(true);
    } else {
      setDeliverError(result.error ?? "Something went wrong.");
    }
    setPending(false);
  }

  /**
   * Execution Sprint entry point (confirmed 2026-08-06) — creates the
   * sprint and triggers the AI-drafted task breakdown, then navigates the
   * reviewer straight to the mandatory Accept/Edit/Reject pass. Only ever
   * offered for approved/edited findings, matching createSprintFromFinding()'s
   * own server-side guard.
   */
  async function handleStartSprint(findingId: string) {
    setStartingSprintFor(findingId);
    setSprintError(null);
    const result = await startExecutionSprintAction(reportId, findingId);
    if (result.success) {
      router.push(`/review-sprint/${result.sprintId}`);
    } else {
      setSprintError(result.error ?? "Something went wrong.");
      setStartingSprintFor(null);
    }
  }

  async function handleRerun() {
    setPending(true);
    setRerunError(null);
    const result = await rerunAuditAction(reportId);
    if (result.success) {
      setRerunResultId(result.newReportId ?? null);
    } else {
      setRerunError(result.error ?? "Something went wrong.");
    }
    setPending(false);
  }

  const undisputedFindings = findings.filter((f) => !f.is_disputed);
  const disputedFindings = findings.filter((f) => f.is_disputed);
  const draftFindings = findings.filter((f) => f.reviewer_status === "draft");
  const unresolvedConflicts = conflicts.filter((c) => c.resolution_status === "unresolved");

  const fixFirstCandidates = findings.filter(
    (f) =>
      f.reviewer_status !== "rejected" &&
      !top3FindingIds.includes(f.id) &&
      isFixFirstCandidate(displayedContent(f)),
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
              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
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

      {(draftFindings.length > 0 || unresolvedConflicts.length > 0) && (
        <section className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
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
        <section className="mb-8 rounded-lg border border-neutral-300 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-900/50">
          <h2 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">Suggested fix-first (not yet in top 3)</h2>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Deterministically flagged: critical severity, or high severity directly blocking the client&apos;s stated goal. A suggestion only — promote
            manually if it belongs in the top 3.
          </p>
          <ul className="space-y-2">
            {fixFirstCandidates.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                <span>
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${SEVERITY_BADGE[displayedContent(f).severity]}`}>
                    {displayedContent(f).severity}
                  </span>
                  {displayedContent(f).title}
                </span>
                {f.reviewer_status === "draft" ? (
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">decide this finding first</span>
                ) : (
                  <Button variant="secondary" disabled={pending} onClick={() => handlePromoteToTop3(f.id)} className="px-2 py-0.5 text-xs">
                    Add to top 3
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {conflicts.length > 0 && (
        <section className="mb-8 rounded-lg border border-orange-300 bg-orange-50 p-5 dark:border-orange-800 dark:bg-orange-950">
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Flagged conflicts</h2>
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
                    <p className="mb-2 rounded border border-orange-200 bg-white px-2 py-1.5 text-xs text-neutral-700 dark:border-orange-900 dark:bg-neutral-900 dark:text-neutral-300">
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
        <section className="mb-8 rounded-lg border border-purple-300 bg-purple-50 p-5 dark:border-purple-800 dark:bg-purple-950">
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Disputed findings (client marked not confident)</h2>
          <ul className="space-y-4">
            {disputedFindings.map((f) => (
              <li key={f.id}>
                <FindingCard f={f} />
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

      {/* Execution Sprint entry point (confirmed 2026-08-06) — reviewer-triggered from an approved/edited finding, no in-app checkout (payment confirmed externally first). */}
      {(reportStatus === "approved" || reportStatus === "sent") && (
        <Card title="Start an Execution Sprint" className="mt-6">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            A bounded 2-4 week paid implementation engagement fixing ONE finding below — only once payment is
            confirmed outside the app. Creates the sprint and AI-drafts its task breakdown; you&apos;ll land on a
            review pass before the client ever sees it.
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
                    {startingSprintFor === f.id ? "Drafting tasks…" : "Start Execution Sprint"}
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
            <a href={`/review/${rerunOfReportId}`} className="underline">
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
                <a href={`/review/${rerunResultId}`} className="underline">
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
                  · {(p.similarityScore * 100).toFixed(0)}% overlap · {p.overlappingTags.join(", ")}
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
      className={`rounded-md border bg-white p-3 shadow-sm dark:bg-neutral-900 ${isDraft ? "border-amber-300 dark:border-amber-800" : "border-neutral-300 dark:border-neutral-700"}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className={`rounded-full px-2 py-0.5 ${SEVERITY_BADGE[content.severity]}`}>{content.severity}</span>
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
    <div className="mt-2 space-y-3 rounded-md border border-blue-300 bg-white p-3 shadow-sm dark:border-blue-800 dark:bg-neutral-900">
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
    <div className="mt-2 space-y-3 rounded-md border border-purple-400 bg-white p-3 shadow-sm dark:border-purple-700 dark:bg-neutral-900">
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
          className="bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700"
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
