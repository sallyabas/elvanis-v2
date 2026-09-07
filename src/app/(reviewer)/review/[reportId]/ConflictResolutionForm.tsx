"use client";

import { useState } from "react";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";

/**
 * Prefilled with the AI-suggested resolution when one exists (confirmed
 * 2026-08-12) — same "AI drafts, reviewer edits or accepts as-is" pattern
 * as every EditForm in this app. An empty initialNotes (older conflicts,
 * or none was ever generated) falls back to the original blank-field
 * behavior, unchanged.
 */
export function ConflictResolutionForm({
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
