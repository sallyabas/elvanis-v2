"use client";

import { useState } from "react";
import { updateTaskStatusAction, updateKpiActualAction, submitChangeRequestNoteAction, signOffSprintAction } from "./actions";

interface SprintTaskRow {
  id: string;
  task_description: string;
  owner: string;
  kpi_description: string | null;
  kpi_target_value: number | null;
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
  companyName,
  findingTitle,
  sprintStatus,
  startDate,
  targetEndDate,
  signedOffAt,
  reviewerCommentary,
  tasks,
  queueItems,
}: {
  sprintId: string;
  companyName: string;
  findingTitle: string;
  sprintStatus: string;
  startDate: string | null;
  targetEndDate: string | null;
  signedOffAt: string | null;
  reviewerCommentary: string | null;
  tasks: SprintTaskRow[];
  queueItems: SprintQueueItemRow[];
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
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        <span>
          Status: <strong className="font-medium capitalize">{sprintStatus.replace("_", " ")}</strong>
        </span>
        {startDate && <span>Started {startDate}</span>}
        {targetEndDate && <span>Target end {targetEndDate}</span>}
      </div>

      {sprintStatus === "complete" && (
        <div className="mt-6 rounded border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
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

      <div className="mt-8 space-y-4">
        {taskState.map((task) => {
          const relatedItems = queueItems.filter((q) => q.sprint_task_id === task.id);
          const isOpen = noteOpenFor === task.id;
          return (
            <div key={task.id} className="rounded border p-4">
              <p className="font-medium">{task.task_description}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Owner: {task.owner}</span>
                {task.due_date && <span>Due {task.due_date}</span>}
              </div>

              {task.kpi_description && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  KPI: {task.kpi_description} — target {task.kpi_target_value} ({task.kpi_direction === "higher_is_better" ? "higher is better" : "lower is better"})
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm">
                  Status:{" "}
                  <select
                    value={task.status}
                    disabled={savingId === task.id || sprintStatus === "complete"}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as SprintTaskRow["status"])}
                    className="rounded border px-2 py-1 text-sm dark:bg-neutral-900"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                {task.kpi_target_value !== null && (
                  <label className="text-sm">
                    Actual:{" "}
                    <input
                      type="number"
                      defaultValue={task.kpi_actual_value ?? undefined}
                      disabled={savingId === task.id || sprintStatus === "complete"}
                      onBlur={(e) => e.target.value !== "" && handleKpiActualSave(task.id, e.target.value)}
                      className="w-24 rounded border px-2 py-1 text-sm dark:bg-neutral-900"
                    />
                  </label>
                )}

                {sprintStatus !== "complete" && (
                  <button type="button" onClick={() => setNoteOpenFor(isOpen ? null : task.id)} className="text-sm text-neutral-500 underline dark:text-neutral-400">
                    Request a change
                  </button>
                )}
              </div>

              {errorById[task.id] && <p className="mt-1 text-xs text-red-600">{errorById[task.id]}</p>}

              {isOpen && (
                <div className="mt-3 rounded border-t pt-3">
                  <textarea
                    value={noteDrafts[task.id] ?? ""}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    placeholder="What would you like changed about this task?"
                    className="w-full rounded border px-2 py-1.5 text-sm dark:bg-neutral-900"
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmitNote(task.id)}
                    disabled={savingId === task.id || !noteDrafts[task.id]?.trim()}
                    className="mt-2 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                  >
                    {savingId === task.id ? "Sending…" : "Send note"}
                  </button>
                </div>
              )}

              {relatedItems.length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {relatedItems.map((item) => (
                    <div key={item.id} className="text-xs">
                      <p className="text-neutral-500 dark:text-neutral-400">
                        {item.trigger_type === "client_note" ? "Your note" : "Flagged"}: {item.note}
                      </p>
                      {item.status === "resolved" && item.reviewer_reply ? (
                        <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">Reply: {item.reviewer_reply}</p>
                      ) : (
                        <p className="mt-0.5 italic text-neutral-400">Awaiting reviewer reply</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sprintStatus === "in_progress" && (
        <div className="mt-8 rounded border p-4">
          {signoffStatus === "done" ? (
            <p className="text-sm text-green-700 dark:text-green-400">Signed off — thanks. Your reviewer will follow up with a final report.</p>
          ) : (
            <>
              <p className="text-sm">{allDone ? "All tasks are marked done." : "You can sign off at any time, even if some tasks aren't marked done."}</p>
              <button
                type="button"
                onClick={handleSignOff}
                disabled={signoffStatus === "saving"}
                className="mt-2 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              >
                {signoffStatus === "saving" ? "Signing off…" : "Sign off on this sprint"}
              </button>
              {signoffStatus === "error" && signoffError && <p className="mt-1 text-xs text-red-600">{signoffError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
