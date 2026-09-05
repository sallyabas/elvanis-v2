"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reviewer Notes — per-company structured list (confirmed 2026-09-05,
 * direct founder decision). Real, structured fields, not free text: every
 * entry has a mandatory Date, a mandatory Name (a short label/title, NOT
 * a person's name), and a Description. See reviewer_notes' own migration
 * docblock for the full two-way-creation/one-way-editing design shared
 * with service-status.ts.
 */
export interface ReviewerNote {
  id: string;
  companyId: string;
  entryDate: string;
  name: string;
  description: string;
  source: "manual" | "service_status";
  createdAt: string;
  updatedAt: string;
}

interface ReviewerNoteRow {
  id: string;
  company_id: string;
  entry_date: string;
  name: string;
  description: string;
  source: "manual" | "service_status";
  created_at: string;
  updated_at: string;
}

function mapRow(row: ReviewerNoteRow): ReviewerNote {
  return {
    id: row.id,
    companyId: row.company_id,
    entryDate: row.entry_date,
    name: row.name,
    description: row.description,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Newest first — a company's real audit trail, read top-down like a log. */
export async function listReviewerNotes(companyId: string): Promise<ReviewerNote[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("reviewer_notes").select("*").eq("company_id", companyId).order("entry_date", { ascending: false });
  if (error) throw new Error(`listReviewerNotes: ${error.message}`);
  return (data as ReviewerNoteRow[]).map(mapRow);
}

/**
 * Manual entry (confirmed 2026-09-05) — the reviewer's own "I can also
 * manually add new entries myself, anytime" path. entryDate defaults to
 * now when not given, since a reviewer adding a note about something
 * that just happened doesn't need to type today's date every time.
 */
export async function addManualReviewerNote(companyId: string, name: string, description: string, entryDate?: string): Promise<void> {
  if (!name.trim()) throw new Error("Name is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("reviewer_notes").insert({
    company_id: companyId,
    entry_date: entryDate ?? new Date().toISOString(),
    name: name.trim(),
    description: description.trim(),
    source: "manual",
  });
  if (error) throw new Error(`addManualReviewerNote: ${error.message}`);
}

/**
 * The one-way-editing side (confirmed 2026-09-05) — once an entry exists
 * (whether auto-created from a service-status note or added manually),
 * further changes to ITS content happen here, never by re-editing the
 * original service record that may have created it.
 */
export async function editReviewerNote(id: string, name: string, description: string, entryDate: string): Promise<void> {
  if (!name.trim()) throw new Error("Name is required.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("reviewer_notes")
    .update({ name: name.trim(), description: description.trim(), entry_date: entryDate, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`editReviewerNote: ${error.message}`);
}

export async function deleteReviewerNote(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("reviewer_notes").delete().eq("id", id);
  if (error) throw new Error(`deleteReviewerNote: ${error.message}`);
}

/**
 * The auto-creation side (confirmed 2026-09-05) — called only from
 * service-status.ts when a service/session reaches Completed status,
 * via either path (a note written, or a plain status-dropdown change
 * with no note). Deliberately a separate, internal-use function rather
 * than exported for general use — this codebase's own "single real
 * trigger point" discipline, matching how every other cross-cutting
 * auto-creation elsewhere here (case_library, notifications) has exactly
 * one real call site.
 */
export async function addServiceStatusReviewerNote(companyId: string, name: string, description: string, entryDate: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("reviewer_notes").insert({
    company_id: companyId,
    entry_date: entryDate,
    name,
    description,
    source: "service_status",
  });
  if (error) throw new Error(`addServiceStatusReviewerNote: ${error.message}`);
}
