"use client";

import { useState } from "react";
import {
  acceptModuleFindingAction,
  editModuleFindingAction,
  rejectModuleFindingAction,
  approveModuleRequestAction,
  generateProcurementAnswersAction,
  acceptProcurementAnswerAction,
  editProcurementAnswerAction,
  rejectProcurementAnswerAction,
} from "./actions";
import { PROCUREMENT_QUESTIONS, type ProcurementCategory } from "@/lib/modules/tender-readiness/procurement-categories";
import { Card } from "@/app/_components/ui/Card";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * Common shape every standalone module's findings follow (confirmed
 * 2026-08-02) — same diagnosis/rootCause/recommendedAction/severity
 * separation as LensFinding, minus the core-audit-specific fields
 * (goalRelevance, financialImpact). Extra module-specific fields (like
 * AI Reliability's "category") are preserved through edits but not
 * rendered generically here.
 */
interface GenericModuleFinding {
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: "critical" | "high" | "medium" | "low";
  confidenceLevel: "high" | "medium" | "low" | "insufficient";
  category?: string;
  evidenceCited?: string[];
  isMissingDataFinding?: boolean;
  [key: string]: unknown;
}

interface FindingRow {
  id: string;
  ai_draft: GenericModuleFinding;
  reviewer_edited_content: GenericModuleFinding | null;
  reviewer_status: "draft" | "edited" | "approved" | "rejected";
  reviewer_notes: string | null;
  confidence_level: string | null;
  is_missing_data_finding: boolean;
}

interface ProcurementAnswerRow {
  id: string;
  category: string;
  question: string;
  ai_draft_answer: string;
  regulations_cited: string[];
  reviewer_status: "draft" | "edited" | "approved" | "rejected";
  reviewer_edited_answer: string | null;
  reviewer_notes: string | null;
}

interface Props {
  requestId: string;
  companyName: string;
  moduleLabel: string;
  requestStatus: string;
  moduleType: string;
  findings: FindingRow[];
  procurementAnswers: ProcurementAnswerRow[];
  timing: { createdAt: string | null; approvedAt: string | null };
  /**
   * Real fix, confirmed 2026-08-15 (module intake/service flow review,
   * item 6) — computed server-side from the request's own already-
   * persisted `intake_data.applicability` (see page.tsx). True only for
   * Tender Readiness/Data Protection Compliance requests where every
   * applicability flag is false — a genuine, deterministic, expected
   * outcome (the company's registration/customer-market data doesn't
   * currently trigger any covered jurisdiction), not a broken pipeline.
   */
  hasNoApplicableJurisdiction: boolean;
}

/**
 * Real corrupted-data bug found live 2026-08-05 (against request
 * 0e46e5dd-...): one finding's reviewer_edited_content was a bare UUID
 * string, not an edited-content object — pre-existing bad data from
 * earlier test passes, not something this pass wrote. Trusting it blindly
 * rendered "undefined" for every field. isValidEditedContent() guards
 * every read site against that shape, falling back to the always-valid
 * ai_draft rather than showing broken content — see also the write-time
 * guard added to editModuleFinding() (module-workspace.ts) so this class
 * of corruption can't be persisted again.
 */
function isValidEditedContent(v: GenericModuleFinding | null): v is GenericModuleFinding {
  return !!v && typeof v === "object" && typeof v.title === "string" && typeof v.diagnosis === "string";
}

function displayedContent(f: FindingRow): GenericModuleFinding {
  return isValidEditedContent(f.reviewer_edited_content) ? f.reviewer_edited_content : f.ai_draft;
}

/**
 * Time-per-audit instrumentation for standalone modules (confirmed
 * 2026-08-04, Priority 3) — mirrors the core-Report pattern
 * (ReviewWorkspaceClient.tsx's formatDuration), but modules have no
 * client-facing edit window (they're created directly in pending_review,
 * per CLAUDE.md: "ready as soon as created"), so there's only one duration
 * to show, not a full-cycle/reviewer-only split — `created_at` already IS
 * the point review became possible for a module request.
 */
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

const STATUS_BADGE: Record<FindingRow["reviewer_status"], string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  edited: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

export function ModuleReviewWorkspaceClient({
  requestId,
  companyName,
  moduleLabel,
  requestStatus,
  moduleType,
  findings,
  procurementAnswers,
  timing,
  hasNoApplicableJurisdiction,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [procurementError, setProcurementError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Real bug found live (confirmed 2026-08-16): every action button on this
  // workspace could get stuck disabled/loading forever on a genuine
  // RPC-level failure — none of these handlers had a try/catch around
  // their await, the same uncaught-RPC-failure class already found and
  // fixed repeatedly on the CLIENT-facing intake forms but never
  // propagated to the reviewer-side workspaces. Fixed with a shared error
  // state and try/catch/finally on every handler here.
  const [actionError, setActionError] = useState<string | null>(null);

  const duration = formatDuration(timing.createdAt, timing.approvedAt);

  async function handleAccept(findingId: string) {
    setPending(true);
    setActionError(null);
    try {
      await acceptModuleFindingAction(requestId, findingId);
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
      await rejectModuleFindingAction(requestId, findingId);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit(f: FindingRow, changes: Partial<GenericModuleFinding>, notes: string) {
    setPending(true);
    setActionError(null);
    try {
      const edited = { ...displayedContent(f), ...changes };
      await editModuleFindingAction(requestId, f.id, edited, notes || undefined);
      setEditingId(null);
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
      const result = await approveModuleRequestAction(requestId);
      setBlockedReason(result.approved ? null : (result.blockedReason ?? "Blocked"));
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleGenerateProcurementAnswers() {
    setPending(true);
    setProcurementError(null);
    try {
      const result = await generateProcurementAnswersAction(requestId);
      if (!result.success) setProcurementError(result.error ?? "Something went wrong.");
    } catch {
      setProcurementError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleAcceptAnswer(answerId: string) {
    setPending(true);
    setActionError(null);
    try {
      await acceptProcurementAnswerAction(requestId, answerId);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleRejectAnswer(answerId: string) {
    setPending(true);
    setActionError(null);
    try {
      await rejectProcurementAnswerAction(requestId, answerId);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveAnswerEdit(answerId: string, editedAnswer: string, notes: string) {
    setPending(true);
    setActionError(null);
    try {
      await editProcurementAnswerAction(requestId, answerId, editedAnswer, notes || undefined);
      setEditingAnswerId(null);
    } catch {
      setActionError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  const draftCount = findings.filter((f) => f.reviewer_status === "draft").length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h1>
      <p className={duration ? "mb-1 text-sm text-neutral-500 dark:text-neutral-400" : "mb-6 text-sm text-neutral-500 dark:text-neutral-400"}>
        {moduleLabel} · status: <span className="font-medium">{requestStatus}</span>
      </p>
      {duration && (
        <p className="mb-6 text-xs text-neutral-500 dark:text-neutral-400">
          Time in review ({timing.approvedAt ? "submitted → approved" : "submitted → now"}): <span className="font-medium">{duration}</span>
        </p>
      )}

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {draftCount > 0 && (
        <section className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Mandatory before this request can be approved:</p>
          <p className="mt-1">{draftCount} finding(s) still need a decision — Accept, Edit, or Reject each one below.</p>
        </section>
      )}

      <Card title="Findings" className="mb-8">
        {findings.length === 0 ? (
          hasNoApplicableJurisdiction ? (
            <Alert variant="info">
              No findings — this is expected, not a broken pipeline. {companyName}&apos;s registration country and
              customer markets, as currently set, don&apos;t trigger any AI-specific jurisdiction this module covers.
              If that seems wrong, check the company&apos;s Business Profile (registration country / customer market
              countries) — this is computed automatically from that data, never AI-judged.
            </Alert>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No findings.</p>
          )
        ) : (
          <ul className="space-y-4">
            {findings.map((f) => (
              <li key={f.id}>
                <FindingCard f={f} />
                {editingId === f.id ? (
                  <EditForm initial={displayedContent(f)} onCancel={() => setEditingId(null)} onSave={(changes, notes) => handleSaveEdit(f, changes, notes)} />
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
        )}
      </Card>

      <Card>
        {blockedReason && (
          <Alert variant="warning" className="mb-3">
            {blockedReason}
          </Alert>
        )}
        <Button disabled={pending || requestStatus !== "pending_review"} onClick={handleApprove}>
          Approve request
        </Button>
      </Card>

      {moduleType === "tender_readiness" && (requestStatus === "approved" || requestStatus === "sent") && (
        <Card title="Procurement answers" className="mt-8">
          <div className="mb-3 flex items-center justify-end">
            <a
              href={`/api/tender-readiness/${requestId}/evidence-pack`}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              download
            >
              Download evidence pack (.md)
            </a>
          </div>
          {procurementAnswers.length === 0 ? (
            <div>
              {hasNoApplicableJurisdiction ? (
                // Real fix (confirmed 2026-08-15, item 6) — clicking
                // "Generate" here could only ever throw
                // generateAndPersistProcurementAnswers()'s own "No
                // applicable regulations" error, every time, for a company
                // that genuinely has none — a dead-end loop, not a
                // transient failure worth retrying. Replaced with an
                // honest explanation instead of a button that always fails.
                <Alert variant="info">
                  No applicable regulations, so there&apos;s nothing to draft procurement answers against — same
                  reason there are no findings above.
                </Alert>
              ) : (
                <>
                  {procurementError && (
                    <Alert variant="error" className="mb-3">
                      {procurementError}
                    </Alert>
                  )}
                  <Button disabled={pending} onClick={handleGenerateProcurementAnswers}>
                    Generate procurement answers
                  </Button>
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                    Drafts answers to 11 standard AI-procurement questions from this request&apos;s reviewer-approved findings and applicable regulations.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-4">
              {procurementAnswers.map((a) => (
                <li key={a.id}>
                  <ProcurementAnswerCard a={a} />
                  {editingAnswerId === a.id ? (
                    <ProcurementAnswerEditForm
                      initial={a.reviewer_edited_answer ?? a.ai_draft_answer}
                      onCancel={() => setEditingAnswerId(null)}
                      onSave={(edited, notes) => handleSaveAnswerEdit(a.id, edited, notes)}
                    />
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" disabled={pending} onClick={() => handleAcceptAnswer(a.id)} className="px-2 py-1 text-xs">
                        Accept
                      </Button>
                      <Button variant="secondary" disabled={pending} onClick={() => setEditingAnswerId(a.id)} className="px-2 py-1 text-xs">
                        Edit
                      </Button>
                      <Button variant="secondary" disabled={pending} onClick={() => handleRejectAnswer(a.id)} className="px-2 py-1 text-xs">
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function ProcurementAnswerCard({ a }: { a: ProcurementAnswerRow }) {
  const isDraft = a.reviewer_status === "draft";
  const label = PROCUREMENT_QUESTIONS[a.category as ProcurementCategory]?.label ?? a.category;
  const displayedAnswer = a.reviewer_edited_answer ?? a.ai_draft_answer;
  return (
    <div
      className={`rounded-md border bg-white p-3 shadow-sm dark:bg-neutral-900 ${isDraft ? "border-amber-300 dark:border-amber-800" : "border-neutral-300 dark:border-neutral-700"}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
        <span className={`rounded-full px-2 py-0.5 ${STATUS_BADGE[a.reviewer_status]}`}>{isDraft ? "needs decision" : a.reviewer_status}</span>
      </div>
      <p className="mb-2 text-xs italic text-neutral-500 dark:text-neutral-400">{a.question}</p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{displayedAnswer}</p>
      {a.regulations_cited.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Cites: {a.regulations_cited.join(", ")}</p>
      )}
      {a.reviewer_notes && <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Reviewer notes: {a.reviewer_notes}</p>}
    </div>
  );
}

function ProcurementAnswerEditForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (edited: string, notes: string) => void;
}) {
  const [answer, setAnswer] = useState(initial);
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-2 space-y-3 rounded-md border border-blue-300 bg-white p-3 shadow-sm dark:border-blue-800 dark:bg-neutral-900">
      <Textarea label="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} />
      <Input placeholder="Reviewer notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={() => onSave(answer, notes)}>
          Save edit
        </Button>
      </div>
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
        <span className={`rounded-full px-2 py-0.5 ${SEVERITY_BADGE[content.severity] ?? ""}`}>{content.severity}</span>
        {content.category && <span>· {content.category}</span>}
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

function EditForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: GenericModuleFinding;
  onCancel: () => void;
  onSave: (changes: Partial<GenericModuleFinding>, notes: string) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [diagnosis, setDiagnosis] = useState(initial.diagnosis);
  const [rootCause, setRootCause] = useState(initial.rootCause);
  const [recommendedAction, setRecommendedAction] = useState(initial.recommendedAction);
  const [severity, setSeverity] = useState(initial.severity);
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-2 space-y-3 rounded-md border border-blue-300 bg-white p-3 shadow-sm dark:border-blue-800 dark:bg-neutral-900">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} />
      <Textarea label="Root cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} />
      <Textarea label="Recommended action" value={recommendedAction} onChange={(e) => setRecommendedAction(e.target.value)} rows={2} />
      <Select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as GenericModuleFinding["severity"])}>
        {(["critical", "high", "medium", "low"] as const).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Input placeholder="Reviewer notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={() => onSave({ title, diagnosis, rootCause, recommendedAction, severity }, notes)}>
          Save edit
        </Button>
      </div>
    </div>
  );
}
