import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Regulatory Freshness Tracker (confirmed 2026-09-05, build brief +
 * "revised decision" follow-up) — full replacement of the earlier
 * regulatory_content_reviews mechanism (regulatory-content-review.ts),
 * not a second parallel tracker. Direct founder reasoning: "since we're
 * still in test phase with no real customers, now is the cheap moment to
 * do this properly." regulatory-content-review.ts and its table are left
 * in place, unmodified, until this replacement is built, rewired, and
 * regression-tested end to end — dropped together as their own separate,
 * later step, not bundled into this same change.
 *
 * Real, confirmed schema differences from the old table (see the
 * migration's own docblock for the full reasoning): review_notes/
 * source_url are genuinely new; last_reviewed_at is nullable (an honest
 * "never yet reviewed" state 6 of the 10 seed rows start in, rendered as
 * "Review pending" and always treated as overdue); staleness_threshold_days
 * is mandatory per row, not a nullable override falling back to one
 * global app_settings default.
 */

export interface RegulatoryFramework {
  id: string;
  name: string;
  shortCode: string;
  jurisdiction: string;
  applicableModules: string[];
  lastReviewedAt: string | null;
  lastReviewedBy: string | null;
  reviewNotes: string | null;
  sourceUrl: string | null;
  stalenessThresholdDays: number;
  createdAt: string;
  updatedAt: string;
}

export type StalenessStatus = "green" | "amber" | "red";

export interface RegulatoryFrameworkWithStatus extends RegulatoryFramework {
  daysSinceReview: number | null;
  status: StalenessStatus;
}

interface FrameworkRow {
  id: string;
  name: string;
  short_code: string;
  jurisdiction: string;
  applicable_modules: string[];
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  review_notes: string | null;
  source_url: string | null;
  staleness_threshold_days: number;
  created_at: string;
  updated_at: string;
  notified_at?: string | null;
}

function mapRow(row: FrameworkRow): RegulatoryFramework {
  return {
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
    jurisdiction: row.jurisdiction,
    applicableModules: row.applicable_modules,
    lastReviewedAt: row.last_reviewed_at,
    lastReviewedBy: row.last_reviewed_by,
    reviewNotes: row.review_notes,
    sourceUrl: row.source_url,
    stalenessThresholdDays: row.staleness_threshold_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The one real staleness-status computation this whole system hangs off —
 * used by the admin page, the reviewer-workspace banner, and the cron
 * check, so all three can never silently disagree about what's overdue.
 * A null lastReviewedAt ("Review pending") is ALWAYS red, by design — the
 * brief's own explicit instruction, not something a threshold comparison
 * would naturally produce.
 */
export function computeStatus(framework: Pick<RegulatoryFramework, "lastReviewedAt" | "stalenessThresholdDays">): { daysSinceReview: number | null; status: StalenessStatus } {
  if (!framework.lastReviewedAt) return { daysSinceReview: null, status: "red" };
  const daysSinceReview = Math.floor((Date.now() - new Date(framework.lastReviewedAt).getTime()) / (24 * 60 * 60 * 1000));
  const amberWindowStart = framework.stalenessThresholdDays - 14;
  let status: StalenessStatus = "green";
  if (daysSinceReview >= framework.stalenessThresholdDays) status = "red";
  else if (daysSinceReview >= amberWindowStart) status = "amber";
  return { daysSinceReview, status };
}

/** Every framework, for the admin page — RED first, then AMBER, then GREEN; within each, days-since-review descending (a "Review pending" row sorts first within red, treated as maximally overdue). */
export async function listRegulatoryFrameworks(): Promise<RegulatoryFrameworkWithStatus[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("regulatory_frameworks").select("*").order("name");
  if (error) throw new Error(`listRegulatoryFrameworks: ${error.message}`);

  const withStatus = (data as FrameworkRow[]).map((row) => {
    const framework = mapRow(row);
    const { daysSinceReview, status } = computeStatus(framework);
    return { ...framework, daysSinceReview, status };
  });

  const statusOrder: Record<StalenessStatus, number> = { red: 0, amber: 1, green: 2 };
  return withStatus.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return (b.daysSinceReview ?? Infinity) - (a.daysSinceReview ?? Infinity);
  });
}

/**
 * "Mark as reviewed" (confirmed 2026-09-05) — sets last_reviewed_at to
 * now, last_reviewed_by to the current reviewer's name, and saves
 * whatever review note was entered. Does NOT auto-populate what was
 * reviewed — that stays the reviewer's own responsibility, per the
 * brief's own explicit instruction.
 */
export async function markFrameworkReviewed(id: string, reviewerName: string, reviewNotes: string | null): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("regulatory_frameworks")
    .update({ last_reviewed_at: new Date().toISOString(), last_reviewed_by: reviewerName, review_notes: reviewNotes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`markFrameworkReviewed: ${error.message}`);
}

/** Full edit — name/jurisdiction/applicable_modules/source_url/staleness_threshold_days, the fields an admin page needs to correct without waiting for a "review" event. */
export async function updateRegulatoryFramework(
  id: string,
  fields: { name?: string; jurisdiction?: string; applicableModules?: string[]; sourceUrl?: string | null; stalenessThresholdDays?: number },
): Promise<void> {
  const admin = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.jurisdiction !== undefined) update.jurisdiction = fields.jurisdiction;
  if (fields.applicableModules !== undefined) update.applicable_modules = fields.applicableModules;
  if (fields.sourceUrl !== undefined) update.source_url = fields.sourceUrl;
  if (fields.stalenessThresholdDays !== undefined) update.staleness_threshold_days = fields.stalenessThresholdDays;
  const { error } = await admin.from("regulatory_frameworks").update(update).eq("id", id);
  if (error) throw new Error(`updateRegulatoryFramework: ${error.message}`);
}

/**
 * Cron-facing (confirmed 2026-09-05) — real, disclosed preservation of the
 * old table's existing email-notification behavior (the original brief's
 * own "No email alerts" line applied to a from-scratch build; this is a
 * migration of already-live working code, which keeps behaving the way it
 * already does). Idempotent per overdue cycle, not per cron tick, same
 * discipline as the old table's own notified_at column. A null
 * lastReviewedAt framework notifies once and never again until it's
 * actually reviewed for the first time (there's no "cycle boundary" to
 * re-arm against until a real last_reviewed_at exists).
 */
export async function checkRegulatoryFrameworksDue(): Promise<{ shortCode: string }[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("regulatory_frameworks").select("*");
  if (error) throw new Error(`checkRegulatoryFrameworksDue: failed to load frameworks: ${error.message}`);

  const due = (rows as FrameworkRow[]).filter((r) => {
    const framework = mapRow(r);
    const { status } = computeStatus(framework);
    if (status !== "red") return false;
    if (!r.notified_at) return true;
    // Never-reviewed rows have no last_reviewed_at to compare notified_at
    // against — "already notified" just means a notification was ever
    // sent, since there's no fresh overdue cycle to re-arm against until
    // a real review happens.
    if (!r.last_reviewed_at) return false;
    return new Date(r.notified_at).getTime() < new Date(r.last_reviewed_at).getTime();
  });
  if (due.length === 0) return [];

  const { data: reviewers, error: reviewersError } = await admin.from("users").select("id").eq("role", "reviewer");
  if (reviewersError) throw new Error(`checkRegulatoryFrameworksDue: failed to load reviewers: ${reviewersError.message}`);

  if ((reviewers ?? []).length > 0) {
    const notificationRows = due.flatMap((row) =>
      (reviewers ?? []).map((reviewer) => ({
        recipient_type: "reviewer" as const,
        recipient_id: reviewer.id,
        event_type: "regulatory_content_review_due",
        channel: "email" as const,
        sent_at: null,
      })),
    );
    const { error: notifError } = await admin.from("notifications").insert(notificationRows);
    if (notifError) throw new Error(`checkRegulatoryFrameworksDue: failed to log notification: ${notifError.message}`);
  }

  const notifiedAt = new Date().toISOString();
  const { error: markError } = await admin
    .from("regulatory_frameworks")
    .update({ notified_at: notifiedAt })
    .in("id", due.map((r) => r.id));
  if (markError) throw new Error(`checkRegulatoryFrameworksDue: failed to mark notified: ${markError.message}`);

  return due.map((r) => ({ shortCode: r.short_code }));
}
