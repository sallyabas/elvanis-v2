"use client";

import { useState } from "react";
import type { ConfidenceLevel, GoalRelevance, LensFinding, LensType, Severity } from "@/lib/lenses/types";
import { matchRecommendationLibraryEntries, type RecommendationLibraryEntry } from "@/lib/recommendations/recommendation-library";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import type { EditFormValues } from "./types";

export function EditForm({
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
