import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Internal idea/feedback backlog (confirmed 2026-08-25, direct founder
 * request) — its own distinct reviewer-only page, deliberately not merged
 * into the queue, pricing panel, or company detail pages. A real,
 * structured table (title/description/source/status as real columns, not
 * a notes/JSON blob) so a future AI-assisted-expansion step (explicitly
 * held, not built here) can reliably read individual fields later without
 * parsing unstructured text first. No RLS on `idea_backlog` — same
 * precedent already used for `pricing`/`app_settings`, both genuinely
 * internal-only tables touched exclusively by the admin client from
 * reviewer-only Server Actions.
 */

export type IdeaSource = "own_idea" | "client_feedback" | "third_party";
export type IdeaStatus = "new" | "considering" | "in_progress" | "done" | "declined";

export interface IdeaBacklogEntry {
  id: string;
  title: string;
  description: string;
  source: IdeaSource;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
}

interface IdeaBacklogRow {
  id: string;
  title: string;
  description: string;
  source: IdeaSource;
  status: IdeaStatus;
  created_at: string;
  updated_at: string;
}

function mapRow(row: IdeaBacklogRow): IdeaBacklogEntry {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listIdeaBacklog(): Promise<IdeaBacklogEntry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("idea_backlog").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`listIdeaBacklog: ${error.message}`);
  return (data as IdeaBacklogRow[]).map(mapRow);
}

export async function createIdeaBacklogEntry(title: string, description: string, source: IdeaSource): Promise<void> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("A title is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("idea_backlog").insert({ title: trimmedTitle, description: description.trim(), source });
  if (error) throw new Error(`createIdeaBacklogEntry: ${error.message}`);
}

export interface IdeaBacklogEdit {
  title?: string;
  description?: string;
  source?: IdeaSource;
  status?: IdeaStatus;
}

export async function updateIdeaBacklogEntry(id: string, edits: IdeaBacklogEdit): Promise<void> {
  const admin = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (edits.title !== undefined) update.title = edits.title.trim();
  if (edits.description !== undefined) update.description = edits.description.trim();
  if (edits.source !== undefined) update.source = edits.source;
  if (edits.status !== undefined) update.status = edits.status;
  const { error } = await admin.from("idea_backlog").update(update).eq("id", id);
  if (error) throw new Error(`updateIdeaBacklogEntry: ${error.message}`);
}

export async function deleteIdeaBacklogEntry(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("idea_backlog").delete().eq("id", id);
  if (error) throw new Error(`deleteIdeaBacklogEntry: ${error.message}`);
}
