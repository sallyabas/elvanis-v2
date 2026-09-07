"use client";

import { useState } from "react";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { saveFindingConciergeNoteAction } from "./actions";
import type { ConciergeNote } from "./types";

/**
 * Reviewer-authored finding note (confirmed 2026-08-24, Concierge tier
 * build) — genuinely new, not reused from an existing pattern. Separate
 * from FindingCard's AI-drafted diagnosis/rootCause/recommendedAction:
 * real, personal context from an actual Discovery/Delivery call that
 * never makes it into the automated findings. One active note per
 * finding, upsert-on-save (see finding-notes.ts's own docblock) — saving
 * an empty textarea clears the note rather than needing a separate
 * delete action. Self-contained, same "own local state, revalidatePath
 * inside the Server Action does the real refresh" pattern as EditForm/
 * DisputeResolutionForm elsewhere in this decomposition.
 */
export function ConciergeNoteEditor({
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
