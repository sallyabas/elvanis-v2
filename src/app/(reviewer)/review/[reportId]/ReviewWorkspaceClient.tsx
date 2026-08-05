"use client";

import { useState } from "react";
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
} from "./actions";
import type { DisputeResolution } from "@/lib/reviewer/workspace";

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
  reportStatus: string;
  top3FindingIds: string[];
  findings: FindingRow[];
  conflicts: ConflictRow[];
  timing: TimingInfo;
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

export function ReviewWorkspaceClient({ reportId, companyName, reportStatus, top3FindingIds, findings, conflicts, timing }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      <h1 className="mb-1 text-2xl font-semibold">{companyName}</h1>
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
        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 font-medium">Top 3 priorities</h2>
          <ol className="space-y-2">
            {top3FindingIds.map((id, i) => {
              const f = findingById.get(id);
              return (
                <li key={id} className="flex items-center justify-between text-sm">
                  <span>
                    {i + 1}. {f ? displayedContent(f).title : id}
                  </span>
                  <span className="flex gap-1">
                    <button disabled={pending || i === 0} onClick={() => handleMoveTop3(i, -1)} className="rounded border px-2 py-0.5 disabled:opacity-30">
                      ↑
                    </button>
                    <button disabled={pending || i === top3FindingIds.length - 1} onClick={() => handleMoveTop3(i, 1)} className="rounded border px-2 py-0.5 disabled:opacity-30">
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {fixFirstCandidates.length > 0 && (
        <section className="mb-8 rounded-lg border border-neutral-300 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-900/50">
          <h2 className="mb-1 font-medium">Suggested fix-first (not yet in top 3)</h2>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Deterministically flagged: critical severity, or high severity directly blocking the client&apos;s stated goal. A suggestion only — promote
            manually if it belongs in the top 3.
          </p>
          <ul className="space-y-2">
            {fixFirstCandidates.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${SEVERITY_BADGE[displayedContent(f).severity]}`}>
                    {displayedContent(f).severity}
                  </span>
                  {displayedContent(f).title}
                </span>
                {f.reviewer_status === "draft" ? (
                  <span className="text-xs text-neutral-400">decide this finding first</span>
                ) : (
                  <button disabled={pending} onClick={() => handlePromoteToTop3(f.id)} className="rounded border px-2 py-0.5 text-xs">
                    Add to top 3
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {conflicts.length > 0 && (
        <section className="mb-8 rounded-lg border border-orange-300 bg-orange-50 p-5 dark:border-orange-800 dark:bg-orange-950">
          <h2 className="mb-3 font-medium">Flagged conflicts</h2>
          <ul className="space-y-4">
            {conflicts.map((c) => {
              const a = findingById.get(c.finding_a_id);
              const b = findingById.get(c.finding_b_id);
              return (
                <li key={c.id} className="text-sm">
                  <p className="mb-1">
                    <strong>{a ? displayedContent(a).title : c.finding_a_id}</strong> vs.{" "}
                    <strong>{b ? displayedContent(b).title : c.finding_b_id}</strong>
                  </p>
                  <p className="mb-2 text-neutral-600 dark:text-neutral-400">{c.conflict_description}</p>
                  {c.resolution_status === "reviewer_resolved" ? (
                    <p className="text-xs text-green-700 dark:text-green-400">Resolved: {c.reviewer_notes}</p>
                  ) : resolvingConflictId === c.id ? (
                    <ConflictResolutionForm onCancel={() => setResolvingConflictId(null)} onSave={(notes) => handleResolveConflict(c.id, notes)} />
                  ) : (
                    <button onClick={() => setResolvingConflictId(c.id)} className="rounded border px-2 py-1 text-xs">
                      Resolve Conflict
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {disputedFindings.length > 0 && (
        <section className="mb-8 rounded-lg border border-purple-300 bg-purple-50 p-5 dark:border-purple-800 dark:bg-purple-950">
          <h2 className="mb-3 font-medium">Disputed findings (client marked not confident)</h2>
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
                  <button onClick={() => setDisputingId(f.id)} className="mt-2 rounded border px-2 py-1 text-xs">
                    Resolve Dispute
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {LENS_ORDER.filter((lens) => undisputedFindings.some((f) => f.lens === lens)).map((lens) => (
        <section key={lens} className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 font-medium">{LENS_LABELS[lens]}</h2>
          <ul className="space-y-4">
            {undisputedFindings
              .filter((f) => f.lens === lens)
              .map((f) => (
                <li key={f.id}>
                  <FindingCard f={f} />
                  {editingId === f.id ? (
                    <EditForm initial={displayedContent(f)} onCancel={() => setEditingId(null)} onSave={(changes, notes) => handleSaveEdit(f, changes, notes)} />
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button disabled={pending} onClick={() => handleAccept(f.id)} className="rounded border px-2 py-1 text-xs">
                        Accept
                      </button>
                      <button disabled={pending} onClick={() => setEditingId(f.id)} className="rounded border px-2 py-1 text-xs">
                        Edit
                      </button>
                      <button disabled={pending} onClick={() => handleReject(f.id)} className="rounded border px-2 py-1 text-xs">
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        {blockedReason && <p className="mb-3 text-sm text-red-600">{blockedReason}</p>}
        <button
          disabled={pending || reportStatus !== "pending_review"}
          onClick={handleApprove}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Approve report
        </button>
      </section>
    </div>
  );
}

function FindingCard({ f }: { f: FindingRow }) {
  const content = displayedContent(f);
  const isDraft = f.reviewer_status === "draft";
  return (
    <div className={`rounded border p-3 ${isDraft ? "border-amber-300 dark:border-amber-800" : "border-neutral-200 dark:border-neutral-700"}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className={`rounded-full px-2 py-0.5 ${SEVERITY_BADGE[content.severity]}`}>{content.severity}</span>
        {f.origin && <span>· {f.origin}</span>}
        <span>· confidence: {content.confidenceLevel}</span>
        <span className={`rounded-full px-2 py-0.5 ${STATUS_BADGE[f.reviewer_status]}`}>{isDraft ? "needs decision" : f.reviewer_status}</span>
      </div>
      <div className="font-medium">{content.title}</div>
      <dl className="mt-2 space-y-1 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400">Diagnosis</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.diagnosis}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400">Root cause</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.rootCause}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400">Recommended action</dt>
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
  initial,
  onCancel,
  onSave,
}: {
  initial: LensFinding;
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

  return (
    <div className="mt-2 space-y-2 rounded border border-blue-300 p-3 dark:border-blue-800">
      <label className="block text-xs font-medium uppercase text-neutral-400">
        Title
        <input className="mt-0.5 w-full rounded border px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-xs font-medium uppercase text-neutral-400">
        Diagnosis
        <textarea className="mt-0.5 w-full rounded border px-2 py-1 text-sm" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} />
      </label>
      <label className="block text-xs font-medium uppercase text-neutral-400">
        Root cause
        <textarea className="mt-0.5 w-full rounded border px-2 py-1 text-sm" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} />
      </label>
      <label className="block text-xs font-medium uppercase text-neutral-400">
        Recommended action
        <textarea
          className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
          value={recommendedAction}
          onChange={(e) => setRecommendedAction(e.target.value)}
          rows={2}
        />
      </label>
      <div className="flex gap-2">
        <select className="rounded border px-2 py-1 text-xs" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          {(["critical", "high", "medium", "low"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="rounded border px-2 py-1 text-xs" value={confidenceLevel} onChange={(e) => setConfidenceLevel(e.target.value as ConfidenceLevel)}>
          {(["high", "medium", "low", "insufficient"] as const).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="rounded border px-2 py-1 text-xs" value={goalRelevance} onChange={(e) => setGoalRelevance(e.target.value as GoalRelevance)}>
          {(["directly_blocks", "directly_affects", "directly_supports", "indirectly_affects", "unrelated"] as const).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <input className="w-full rounded border px-2 py-1 text-xs" placeholder="Reviewer notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex gap-2">
        <button className="rounded border px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
          onClick={() => onSave({ title, diagnosis, rootCause, recommendedAction, severity, confidenceLevel, goalRelevance }, notes)}
        >
          Save edit
        </button>
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
    <div className="mt-2 space-y-2 rounded border border-purple-400 p-3 dark:border-purple-700">
      <div className="flex gap-3 text-xs">
        {(["keep_ai_version", "side_with_client", "edit"] as const).map((r) => (
          <label key={r} className="flex items-center gap-1">
            <input type="radio" name="resolution" checked={resolution === r} onChange={() => setResolution(r)} />
            {r.replaceAll("_", " ")}
          </label>
        ))}
      </div>
      {resolution === "edit" && (
        <>
          <input className="w-full rounded border px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="w-full rounded border px-2 py-1 text-sm" placeholder="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} />
          <textarea className="w-full rounded border px-2 py-1 text-sm" placeholder="Root cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} />
          <textarea
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Recommended action"
            value={recommendedAction}
            onChange={(e) => setRecommendedAction(e.target.value)}
            rows={2}
          />
          <select className="rounded border px-2 py-1 text-xs" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {(["critical", "high", "medium", "low"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </>
      )}
      <input
        className="w-full rounded border px-2 py-1 text-xs"
        placeholder="Resolution reasoning (required)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="rounded border px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </button>
        <button
          disabled={!notes.trim()}
          className="rounded bg-purple-600 px-2 py-1 text-xs text-white disabled:opacity-40"
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
        </button>
      </div>
    </div>
  );
}

function ConflictResolutionForm({ onCancel, onSave }: { onCancel: () => void; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-2">
      <input
        className="w-full rounded border px-2 py-1 text-xs"
        placeholder="Which finding wins, or a merged explanation (required)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="rounded border px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </button>
        <button disabled={!notes.trim()} className="rounded bg-orange-600 px-2 py-1 text-xs text-white disabled:opacity-40" onClick={() => onSave(notes)}>
          Save resolution
        </button>
      </div>
    </div>
  );
}
