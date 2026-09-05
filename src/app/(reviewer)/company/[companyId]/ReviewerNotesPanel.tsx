"use client";

import { useState } from "react";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { addManualReviewerNoteAction, editReviewerNoteAction, deleteReviewerNoteAction } from "./actions";
import type { ReviewerNote } from "@/lib/reviewer/reviewer-notes";

/**
 * Reviewer Notes — per-company structured list (confirmed 2026-09-05,
 * direct founder decision). Real client component for the same reasons
 * as ServiceStatusRow/FrameworkRow — inline add/edit/delete with
 * immediate feedback, not a bare <form> per row.
 *
 * Two-way creation, one-way editing (see this table's own migration
 * docblock): entries created automatically from service-status.ts (when
 * a service reaches Completed) show a "from service status" tag and are
 * edited HERE, never by re-editing the original service record — this
 * panel is the one real place any entry's content changes after
 * creation, regardless of how it was created.
 */
function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function NoteRow({ companyId, note }: { companyId: string; note: ReviewerNote }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(note.name);
  const [description, setDescription] = useState(note.description);
  const [date, setDate] = useState(toDateInputValue(note.entryDate));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await editReviewerNoteAction(companyId, note.id, name, description, new Date(date).toISOString());
      setEditing(false);
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteReviewerNoteAction(companyId, note.id);
    } catch {
      setError("Something went wrong reaching the server — please try again.");
      setPending(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="space-y-2">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          {error && (
            <Alert variant="error" className="py-1 text-xs">
              {error}
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="px-2 py-1 text-xs" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" className="px-2 py-1 text-xs" disabled={pending} onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-medium text-neutral-900 dark:text-neutral-50">{note.name}</span>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">{new Date(note.entryDate).toLocaleDateString()}</span>
        {note.source === "service_status" && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            from service status
          </span>
        )}
      </div>
      {note.description && <p className="mb-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{note.description}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-neutral-500 hover:underline dark:text-neutral-400">
          Edit
        </button>
        <button type="button" onClick={handleDelete} disabled={pending} className="text-xs text-neutral-500 hover:underline dark:text-neutral-400">
          Delete
        </button>
      </div>
      {error && (
        <Alert variant="error" className="mt-1 py-1 text-xs">
          {error}
        </Alert>
      )}
    </li>
  );
}

export function ReviewerNotesPanel({ companyId, notes }: { companyId: string; notes: ReviewerNote[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date().toISOString()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addManualReviewerNoteAction(companyId, name, description, new Date(date).toISOString());
      setName("");
      setDescription("");
      setAdding(false);
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {notes.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">No reviewer notes yet.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {notes.map((n) => (
            <NoteRow key={n.id} companyId={companyId} note={n} />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Name" placeholder="A short label/title, not a person's name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          {error && (
            <Alert variant="error" className="py-1 text-xs">
              {error}
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="px-2 py-1 text-xs" disabled={pending} onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="button" className="px-2 py-1 text-xs" disabled={pending} onClick={handleAdd}>
              Add entry
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setAdding(true)}>
          + Add entry
        </Button>
      )}
    </div>
  );
}
