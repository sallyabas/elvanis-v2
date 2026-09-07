"use client";

import { useState } from "react";
import type { LensFinding, Severity } from "@/lib/lenses/types";
import type { DisputeResolution } from "@/lib/reviewer/workspace";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import type { EditFormValues } from "./types";

export function DisputeResolutionForm({
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
