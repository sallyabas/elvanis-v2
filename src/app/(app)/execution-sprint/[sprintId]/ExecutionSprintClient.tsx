"use client";

import { useState } from "react";
import Link from "next/link";
import { updateTaskStatusAction, updateKpiActualAction, submitChangeRequestNoteAction, signOffSprintAction } from "./actions";
import type { NextPriorityFinding } from "@/lib/execution-sprint/next-priority";
import { Card } from "@/app/_components/ui/Card";
import { Select } from "@/app/_components/ui/Select";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";
import { LinkButton } from "@/app/_components/ui/LinkButton";
import { Alert } from "@/app/_components/ui/Alert";

const LENS_LABELS: Record<NextPriorityFinding["lens"], string> = {
  financial: "Financial",
  execution: "Execution / Operating",
  product: "Product / Customer",
  commercial: "Commercial / Market",
  ai_governance: "AI & Governance",
};

interface SprintTaskRow {
  id: string;
  task_description: string;
  owner: string;
  kpi_description: string | null;
  kpi_target_value: number | null;
  kpi_unit: string | null;
  kpi_actual_value: number | null;
  kpi_direction: "higher_is_better" | "lower_is_better" | null;
  status: "not_started" | "in_progress" | "done";
  due_date: string | null;
  reviewer_status: string;
}

interface SprintQueueItemRow {
  id: string;
  sprint_task_id: string | null;
  trigger_type: "client_note" | "kpi_deviation";
  note: string | null;
  status: "open" | "resolved";
  reviewer_reply: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<SprintTaskRow["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

/**
 * Client-facing Execution Sprint page (confirmed 2026-08-06) — the
 * approved plan is locked: task description, owner, KPI target/direction,
 * and due date are all read-only here. Only status and the KPI actual
 * value are editable, and a client who wants the locked plan itself
 * changed can only submit a note requesting it — never edit it directly.
 */
export function ExecutionSprintClient({
  sprintId,
  reportId,
  companyName,
  findingTitle,
  sprintStatus,
  startDate,
  targetEndDate,
  signedOffAt,
  reviewerCommentary,
  tasks,
  queueItems,
  nextPriority,
}: {
  sprintId: string;
  reportId: string;
  companyName: string;
  findingTitle: string;
  sprintStatus: string;
  startDate: string | null;
  targetEndDate: string | null;
  signedOffAt: string | null;
  reviewerCommentary: string | null;
  tasks: SprintTaskRow[];
  queueItems: SprintQueueItemRow[];
  /** Sprint-completion bridge (confirmed 2026-08-13) — null means either the sprint isn't complete yet, or genuinely no other real, actionable priority exists on this report; both are honest, not an error state. */
  nextPriority: NextPriorityFinding | null;
}) {
  const [taskState, setTaskState] = useState(tasks);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [signoffStatus, setSignoffStatus] = useState<"idle" | "saving" | "done" | "error">(sprintStatus === "complete" ? "done" : "idle");
  const [signoffError, setSignoffError] = useState<string | null>(null);

  function updateTaskLocal(taskId: string, patch: Partial<SprintTaskRow>) {
    setTaskState((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  }

  async function handleStatusChange(taskId: string, status: SprintTaskRow["status"]) {
    setSavingId(taskId);
    setErrorById((prev) => ({ ...prev, [taskId]: "" }));
    const result = await updateTaskStatusAction(sprintId, taskId, status);
    if (result.success) {
      updateTaskLocal(taskId, { status });
    } else {
      setErrorById((prev) => ({ ...prev, [taskId]: result.error ?? "Failed to save." }));
    }
    setSavingId(null);
  }

  async function handleKpiActualSave(taskId: string, value: string) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setErrorById((prev) => ({ ...prev, [taskId]: "Enter a number." }));
      return;
    }
    setSavingId(taskId);
    setErrorById((prev) => ({ ...prev, [taskId]: "" }));
    const result = await updateKpiActualAction(sprintId, taskId, parsed);
    if (result.success) {
      updateTaskLocal(taskId, { kpi_actual_value: parsed });
    } else {
      setErrorById((prev) => ({ ...prev, [taskId]: result.error ?? "Failed to save." }));
    }
    setSavingId(null);
  }

  async function handleSubmitNote(taskId: string) {
    const note = noteDrafts[taskId]?.trim();
    if (!note) return;
    setSavingId(taskId);
    setErrorById((prev) => ({ ...prev, [taskId]: "" }));
    const result = await submitChangeRequestNoteAction(sprintId, taskId, note);
    if (result.success) {
      setNoteDrafts((prev) => ({ ...prev, [taskId]: "" }));
      setNoteOpenFor(null);
    } else {
      setErrorById((prev) => ({ ...prev, [taskId]: result.error ?? "Failed to submit." }));
    }
    setSavingId(null);
  }

  async function handleSignOff() {
    setSignoffStatus("saving");
    setSignoffError(null);
    const result = await signOffSprintAction(sprintId);
    if (result.success) {
      setSignoffStatus("done");
    } else {
      setSignoffStatus("error");
      setSignoffError(result.error ?? "Failed to sign off.");
    }
  }

  const allDone = taskState.length > 0 && taskState.every((t) => t.status === "done");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{companyName} — Execution Sprint</p>
      <h1 className="mt-1 text-2xl font-semibold">{findingTitle}</h1>
      {/* Real narrative intro (confirmed 2026-08-19, direct founder
          request) — a client landing here previously had no plain-English
          framing of what this page even is before the task list started. */}
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        This sprint exists to fix &quot;{findingTitle}&quot; — your reviewer has broken it into the tasks below. Update
        Status and Actual as work happens.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        <span>
          Status: <strong className="font-medium capitalize">{sprintStatus.replace("_", " ")}</strong>
        </span>
        {startDate && <span>Started {startDate}</span>}
        {targetEndDate && <span>Target end {targetEndDate}</span>}
      </div>

      {sprintStatus === "complete" && (
        <div className="mt-6 rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">Signed off {signedOffAt ? new Date(signedOffAt).toLocaleDateString() : ""}</p>
          {reviewerCommentary ? (
            <div className="mt-2 text-sm text-green-900 dark:text-green-200">
              <p className="mb-1 font-medium">Final report</p>
              <p className="whitespace-pre-wrap">{reviewerCommentary}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-green-700 dark:text-green-400">Your reviewer will add a final wrap-up commentary shortly.</p>
          )}
        </div>
      )}

      {sprintStatus === "complete" && (
        <Card className="mt-4">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">What&apos;s next?</p>
          {nextPriority ? (
            <>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {nextPriority.isFixFirstCandidate ? "Your reviewer's next suggested fix-first priority: " : "Your next highest-priority open item: "}
                <span className="font-medium text-neutral-900 dark:text-neutral-50">{nextPriority.title}</span> ({LENS_LABELS[nextPriority.lens]}, {nextPriority.severity} severity).
              </p>
              <LinkButton href={`/reports/${reportId}`} variant="secondary" className="mt-3">
                View full report and roadmap →
              </LinkButton>
            </>
          ) : (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">No other high-priority open items remain on this report right now — nice work. Check your full report for the complete picture.</p>
          )}
        </Card>
      )}

      <div className="mt-8 space-y-4">
        {taskState.map((task) => {
          const relatedItems = queueItems.filter((q) => q.sprint_task_id === task.id);
          const isOpen = noteOpenFor === task.id;
          return (
            <Card key={task.id}>
              <p className="font-medium text-neutral-900 dark:text-neutral-50">{task.task_description}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Owner: {task.owner}</span>
                {task.due_date && <span>Due {task.due_date}</span>}
              </div>

              {task.kpi_description && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  KPI: {task.kpi_description} — target {task.kpi_target_value}
                  {task.kpi_unit ? ` ${task.kpi_unit}` : ""} ({task.kpi_direction === "higher_is_better" ? "higher is better" : "lower is better"})
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Select
                  label="Status"
                  value={task.status}
                  disabled={savingId === task.id || sprintStatus === "complete"}
                  onChange={(e) => handleStatusChange(task.id, e.target.value as SprintTaskRow["status"])}
                  className="w-40"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>

                {task.kpi_target_value !== null && (
                  <Input
                    label="Actual"
                    type="number"
                    defaultValue={task.kpi_actual_value ?? undefined}
                    disabled={savingId === task.id || sprintStatus === "complete"}
                    onBlur={(e) => e.target.value !== "" && handleKpiActualSave(task.id, e.target.value)}
                    className="w-24"
                    // Real, dedicated kpi_unit field (confirmed
                    // 2026-08-19, direct founder request) — supersedes the
                    // interim fix that reused kpi_description as this
                    // input's hint. Existing (pre-migration) task rows
                    // have kpi_unit: null (no automated backfill — see the
                    // migration's own docblock), so this falls back to the
                    // old kpi_description behavior for those, never a
                    // blank hint.
                    hint={task.kpi_unit ?? task.kpi_description ?? undefined}
                  />
                )}

                {sprintStatus !== "complete" && (
                  <div className="pb-2">
                    <button type="button" onClick={() => setNoteOpenFor(isOpen ? null : task.id)} className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                      Request a change
                    </button>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Ask your reviewer to adjust a task&apos;s owner, due date, or scope.</p>
                  </div>
                )}
              </div>

              {errorById[task.id] && (
                <Alert variant="error" className="mt-1 py-2 text-xs">
                  {errorById[task.id]}
                </Alert>
              )}

              {isOpen && (
                <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  <Textarea
                    value={noteDrafts[task.id] ?? ""}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    placeholder="What would you like changed about this task?"
                    rows={3}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSubmitNote(task.id)}
                    disabled={savingId === task.id || !noteDrafts[task.id]?.trim()}
                    className="px-3 py-1.5"
                  >
                    {savingId === task.id ? "Sending…" : "Send note"}
                  </Button>
                </div>
              )}

              {relatedItems.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  {relatedItems.map((item) => (
                    <div key={item.id} className="text-xs">
                      <p className="text-neutral-500 dark:text-neutral-400">
                        {item.trigger_type === "client_note" ? "Your note" : "Flagged"}: {item.note}
                      </p>
                      {item.status === "resolved" && item.reviewer_reply ? (
                        <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">Reply: {item.reviewer_reply}</p>
                      ) : (
                        <p className="mt-0.5 italic text-neutral-400 dark:text-neutral-500">Awaiting reviewer reply</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {sprintStatus === "in_progress" && (
        <Card className="mt-8">
          {signoffStatus === "done" ? (
            <p className="text-sm text-green-700 dark:text-green-400">Signed off — thanks. Your reviewer will follow up with a final report.</p>
          ) : (
            <>
              <p className="text-sm text-neutral-800 dark:text-neutral-200">
                {allDone ? "All tasks are marked done." : "You can sign off at any time, even if some tasks aren't marked done."}
              </p>
              <Button type="button" variant="secondary" onClick={handleSignOff} disabled={signoffStatus === "saving"} className="mt-2 px-3 py-1.5">
                {signoffStatus === "saving" ? "Signing off…" : "Sign off on this sprint"}
              </Button>
              {signoffStatus === "error" && signoffError && (
                <Alert variant="error" className="mt-2 py-2 text-xs">
                  {signoffError}
                </Alert>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
