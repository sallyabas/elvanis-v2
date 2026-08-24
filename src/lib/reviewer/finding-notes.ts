import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reviewer-authored notes attached to a specific finding (confirmed
 * 2026-08-24, direct founder request, Concierge tier build) — genuinely
 * new, not reused from an existing pattern. Separate from the AI-drafted
 * diagnosis/rootCause/recommendedAction and the mandatory Accept/Edit/
 * Reject review pipeline: this is real, personal context from an actual
 * Discovery/Delivery call that never makes it into the automated
 * findings — "the tangible thing that makes Concierge worth the
 * premium," in the founder's own words. See the migration's own docblock
 * (20260824090000) for why this is its own table (finding_concierge_notes)
 * rather than a column on lens_findings, and why it's scoped to one
 * active note per finding rather than a running comment thread.
 *
 * Scoped to lens_findings (the core audit) only, not module_findings —
 * matches the founder's own framing (Discovery/Delivery calls tie to the
 * core audit's report), a deliberate v1 scoping decision, not an
 * oversight; expanding to modules is real, separate follow-on scope if
 * ever needed.
 */

export interface FindingConciergeNote {
  findingId: string;
  reviewerId: string;
  authorName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface FindingConciergeNoteRow {
  finding_id: string;
  reviewer_id: string;
  author_name: string;
  note: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: FindingConciergeNoteRow): FindingConciergeNote {
  return {
    findingId: row.finding_id,
    reviewerId: row.reviewer_id,
    authorName: row.author_name,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every note for a set of findings, keyed by findingId — one query per report render, not N. */
export async function loadFindingConciergeNotes(findingIds: string[]): Promise<Map<string, FindingConciergeNote>> {
  if (findingIds.length === 0) return new Map();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("finding_concierge_notes").select("*").in("finding_id", findingIds);
  if (error) throw new Error(`loadFindingConciergeNotes: ${error.message}`);
  return new Map((data as FindingConciergeNoteRow[]).map((row) => [row.finding_id, mapRow(row)]));
}

/**
 * Reviewer-only — caller (the Server Action) is responsible for the
 * session+role check, same discipline as every other reviewer write in
 * this codebase. Upsert on finding_id (the table's own unique
 * constraint), so re-saving the same finding replaces the existing note
 * rather than erroring or duplicating — "one active note per finding."
 * An empty/whitespace-only note deletes the row instead of saving a
 * blank one — a reviewer clearing the textarea and saving is the natural
 * way to remove a note, not a separate delete button/action.
 */
export async function saveFindingConciergeNote(findingId: string, reviewerId: string, authorName: string, note: string): Promise<void> {
  const supabase = createAdminClient();
  const trimmedNote = note.trim();
  const trimmedName = authorName.trim();

  if (trimmedNote.length === 0) {
    const { error } = await supabase.from("finding_concierge_notes").delete().eq("finding_id", findingId);
    if (error) throw new Error(`saveFindingConciergeNote (clear): ${error.message}`);
    return;
  }
  if (trimmedName.length === 0) throw new Error("A name is required to save a note.");

  const { error } = await supabase
    .from("finding_concierge_notes")
    .upsert(
      { finding_id: findingId, reviewer_id: reviewerId, author_name: trimmedName, note: trimmedNote, updated_at: new Date().toISOString() },
      { onConflict: "finding_id" },
    );
  if (error) throw new Error(`saveFindingConciergeNote: ${error.message}`);
}
