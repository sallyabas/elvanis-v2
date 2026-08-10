"use client";

import { useState } from "react";
import {
  acceptSprintTaskAction,
  editSprintTaskAction,
  rejectSprintTaskAction,
  approveSprintTasksAction,
  addSprintReviewerCommentaryAction,
} from "./actions";
import { Card } from "@/app/_components/ui/Card";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

interface SprintTaskRow {
  id: string;
  task_description: string;
  owner: string | null;
  kpi_description: string | null;
  kpi_target_value: number | null;
  kpi_actual_value: number | null;
  kpi_direction: "higher_is_better" | "lower_is_better" | null;
  status: string;
  due_date: string | null;
  reviewer_status: "draft" | "edited" | "approved" | "rejected";
}

interface Props {
  sprintId: string;
  companyName: string;
  findingTitle: string;
  sprintStatus: string;
  signedOffAt: string | null;
  reviewerCommentary: string | null;
  tasks: SprintTaskRow[];
}

const STATUS_BADGE: Record<SprintTaskRow["reviewer_status"], string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  edited: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function SprintReviewWorkspaceClient({ sprintId, companyName, findingTitle, sprintStatus, signedOffAt, reviewerCommentary, tasks }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [commentary, setCommentary] = useState(reviewerCommentary ?? "");

  const draftCount = tasks.filter((t) => t.reviewer_status === "draft").length;

  async function handleAccept(taskId: string) {
    setPending(true);
    await acceptSprintTaskAction(sprintId, taskId);
    setPending(false);
  }

  async function handleReject(taskId: string) {
    setPending(true);
    await rejectSprintTaskAction(sprintId, taskId);
    setPending(false);
  }

  async function handleSaveEdit(taskId: string, edits: Parameters<typeof editSprintTaskAction>[2]) {
    setPending(true);
    await editSprintTaskAction(sprintId, taskId, edits);
    setEditingId(null);
    setPending(false);
  }

  async function handleApprove() {
    setPending(true);
    const result = await approveSprintTasksAction(sprintId);
    setBlockedReason(result.approved ? null : (result.blockedReason ?? "Blocked"));
    setPending(false);
  }

  async function handleSaveCommentary() {
    setPending(true);
    await addSprintReviewerCommentaryAction(sprintId, commentary);
    setPending(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h1>
      <p className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">
        Execution Sprint · status: <span className="font-medium">{sprintStatus}</span>
      </p>
      <p className="mb-6 text-xs text-neutral-500 dark:text-neutral-400">Fixing: {findingTitle}</p>

      {draftCount > 0 && (
        <section className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Mandatory before this sprint can start:</p>
          <p className="mt-1">{draftCount} task(s) still need a decision — Accept, Edit, or Reject each one below.</p>
        </section>
      )}

      <Card title="AI-drafted task breakdown" className="mb-8">
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Once approved, this plan is locked for the client — they can update task status and KPI actuals freely, but
          changing the plan itself goes through a change-request note, not a direct edit.
        </p>
        {tasks.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No tasks.</p>
        ) : (
          <ul className="space-y-4">
            {tasks.map((t) => (
              <li key={t.id}>
                <TaskCard t={t} />
                {editingId === t.id ? (
                  <EditForm initial={t} onCancel={() => setEditingId(null)} onSave={(edits) => handleSaveEdit(t.id, edits)} />
                ) : (
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" disabled={pending} onClick={() => handleAccept(t.id)} className="px-2 py-1 text-xs">
                      Accept
                    </Button>
                    <Button variant="secondary" disabled={pending} onClick={() => setEditingId(t.id)} className="px-2 py-1 text-xs">
                      Edit
                    </Button>
                    <Button variant="secondary" disabled={pending} onClick={() => handleReject(t.id)} className="px-2 py-1 text-xs">
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
        <Button disabled={pending || sprintStatus !== "scoped"} onClick={handleApprove}>
          Approve sprint plan
        </Button>
      </Card>

      {signedOffAt && (
        <Card title="Client signed off" className="mt-8">
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Signed off {new Date(signedOffAt).toLocaleString()}. Your commentary below is the final report — not a
            separately AI-generated document.
          </p>
          <Textarea rows={5} placeholder="What happened, what still needs work..." value={commentary} onChange={(e) => setCommentary(e.target.value)} />
          <Button disabled={pending} onClick={handleSaveCommentary} className="mt-2 px-3 py-1.5">
            Save commentary
          </Button>
        </Card>
      )}
    </div>
  );
}

function TaskCard({ t }: { t: SprintTaskRow }) {
  const isDraft = t.reviewer_status === "draft";
  return (
    <div
      className={`rounded-md border bg-white p-3 shadow-sm dark:bg-neutral-900 ${isDraft ? "border-amber-300 dark:border-amber-800" : "border-neutral-300 dark:border-neutral-700"}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className={`rounded-full px-2 py-0.5 ${STATUS_BADGE[t.reviewer_status]}`}>{isDraft ? "needs decision" : t.reviewer_status}</span>
        {t.owner && <span>· owner: {t.owner}</span>}
        {t.due_date && <span>· due {t.due_date}</span>}
      </div>
      <div className="font-medium text-neutral-900 dark:text-neutral-50">{t.task_description}</div>
      {t.kpi_description && (
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          KPI: {t.kpi_description} — target {t.kpi_target_value} ({t.kpi_direction === "higher_is_better" ? "higher is better" : "lower is better"})
        </p>
      )}
    </div>
  );
}

function EditForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: SprintTaskRow;
  onCancel: () => void;
  onSave: (edits: {
    taskDescription?: string;
    owner?: string;
    kpiDescription?: string;
    kpiTargetValue?: number;
    kpiDirection?: "higher_is_better" | "lower_is_better";
  }) => void;
}) {
  const [taskDescription, setTaskDescription] = useState(initial.task_description);
  const [owner, setOwner] = useState(initial.owner ?? "");
  const [kpiDescription, setKpiDescription] = useState(initial.kpi_description ?? "");
  const [kpiTargetValue, setKpiTargetValue] = useState(initial.kpi_target_value?.toString() ?? "");
  const [kpiDirection, setKpiDirection] = useState<"higher_is_better" | "lower_is_better">(initial.kpi_direction ?? "higher_is_better");

  return (
    <div className="mt-2 space-y-3 rounded-md border border-blue-300 bg-white p-3 shadow-sm dark:border-blue-800 dark:bg-neutral-900">
      <Textarea label="Task description" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} rows={2} />
      <Input label="Owner (role label)" value={owner} onChange={(e) => setOwner(e.target.value)} />
      <Input label="KPI description" value={kpiDescription} onChange={(e) => setKpiDescription(e.target.value)} />
      <div className="flex gap-2">
        <Input label="Target value" type="number" value={kpiTargetValue} onChange={(e) => setKpiTargetValue(e.target.value)} />
        <Select label="Direction" value={kpiDirection} onChange={(e) => setKpiDirection(e.target.value as "higher_is_better" | "lower_is_better")}>
          <option value="higher_is_better">Higher is better</option>
          <option value="lower_is_better">Lower is better</option>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="px-2 py-1 text-xs"
          onClick={() =>
            onSave({
              taskDescription,
              owner,
              kpiDescription,
              kpiTargetValue: kpiTargetValue === "" ? undefined : Number(kpiTargetValue),
              kpiDirection,
            })
          }
        >
          Save edit
        </Button>
      </div>
    </div>
  );
}
