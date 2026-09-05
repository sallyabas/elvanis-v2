import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";

/**
 * Periodic regulatory-content-review flag (spec §1.8b, confirmed
 * 2026-08-02; extended 2026-08-03 to cover Data Protection Compliance's
 * regulations, not just Tender Readiness's; extended 2026-09-03 with
 * uae_pdpl/adgm_dpr; extended again 2026-09-04 with difc_dpl PLUS a real
 * per-jurisdiction cadence override) — a distinct concern from re-audit
 * reminders. Re-audit reminders are about a client's data going stale;
 * this is about the REGULATORY REFERENCE CONTENT itself going stale
 * (Saudi's Responsible AI Policy is still in draft, the UAE's Federal
 * Authority for AI and Data could issue binding rules at any time, the UAE
 * Data Office has not yet published its own adequacy list for federal
 * PDPL cross-border transfers, and DIFC's own law has seen real,
 * scope-expanding amendments that may or may not have already taken
 * effect — confirmed actively in flux, distinct from the more settled
 * regimes already tracked here). Fully generic against whatever rows
 * exist in `regulatory_content_reviews` — covers eu_ai_act/uae_difc_reg10/
 * saudi_ai_governance (Tender Readiness) and uk_gdpr/eu_gdpr/saudi_pdpl/
 * uae_pdpl/adgm_dpr/difc_dpl (Data Protection Compliance) with no code
 * change, only seed-data additions. Notifies every reviewer — this is a
 * content-maintenance task, not something a client sees. This mechanism
 * ITSELF was already real and fully wired (cron-scheduled, inserts real
 * `notifications` rows, has a real email template) before DIFC's shorter
 * cadence was requested — the only change needed was making the cadence
 * per-jurisdiction rather than one global number for every row.
 */
export interface RegulatoryContentReviewDue {
  jurisdiction: string;
}

export async function checkRegulatoryContentReviewDue(): Promise<RegulatoryContentReviewDue[]> {
  const supabase = createAdminClient();
  const globalCadenceDays = await getSettingNumber("regulatory_content_review_days", 180);

  const { data: rows, error } = await supabase
    .from("regulatory_content_reviews")
    .select("jurisdiction, last_reviewed_at, notified_at, review_cadence_days");
  if (error) throw new Error(`checkRegulatoryContentReviewDue: failed to load review rows: ${error.message}`);

  // Overdue (per this ROW's own cadence override, or the global default
  // when it has none — confirmed 2026-09-04, DIFC gets a real 90-day
  // override) AND not already notified since the last actual human review
  // — idempotent per overdue cycle, not per cron tick (a real bug found
  // live: without this, a 15-minute cron would re-notify every 15 minutes
  // for as long as a jurisdiction stayed overdue).
  const due = (rows ?? []).filter((r) => {
    const cadenceDays = r.review_cadence_days ?? globalCadenceDays;
    const cutoffMs = Date.now() - cadenceDays * 24 * 60 * 60 * 1000;
    const overdue = new Date(r.last_reviewed_at).getTime() <= cutoffMs;
    const alreadyNotifiedThisCycle = r.notified_at && new Date(r.notified_at).getTime() >= new Date(r.last_reviewed_at).getTime();
    return overdue && !alreadyNotifiedThisCycle;
  });
  if (due.length === 0) return [];

  const { data: reviewers, error: reviewersError } = await supabase.from("users").select("id").eq("role", "reviewer");
  if (reviewersError) throw new Error(`checkRegulatoryContentReviewDue: failed to load reviewers: ${reviewersError.message}`);

  const notifiedAt = new Date().toISOString();

  // Real perf fix (confirmed 2026-09-05, code-quality audit) — this was a
  // genuine nested loop, O(overdue jurisdictions × reviewers), one INSERT
  // per pair. Flattened into a single batched insert covering every
  // (row, reviewer) pair at once, and the per-row `notified_at` updates
  // (all being set to the identical timestamp) collapsed into one UPDATE
  // via `.in()` instead of one per due row.
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
    const { error: notifError } = await supabase.from("notifications").insert(notificationRows);
    if (notifError) throw new Error(`checkRegulatoryContentReviewDue: failed to log notification: ${notifError.message}`);
  }

  const { error: markError } = await supabase
    .from("regulatory_content_reviews")
    .update({ notified_at: notifiedAt })
    .in(
      "jurisdiction",
      due.map((r) => r.jurisdiction),
    );
  if (markError) throw new Error(`checkRegulatoryContentReviewDue: failed to mark notified: ${markError.message}`);

  return due.map((r) => ({ jurisdiction: r.jurisdiction as string }));
}

/** Called once a reviewer has actually re-verified a jurisdiction's regulatory content — resets its cadence clock. */
export async function markRegulatoryContentReviewed(jurisdiction: string, reviewerId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("regulatory_content_reviews")
    .update({ last_reviewed_at: new Date().toISOString(), reviewed_by: reviewerId })
    .eq("jurisdiction", jurisdiction);
  if (error) throw new Error(`markRegulatoryContentReviewed failed: ${error.message}`);
}

/**
 * Read-only status for every tracked jurisdiction, for display purposes
 * (confirmed 2026-08-03 — the mechanism above tracked this from the start
 * but nothing ever surfaced it visibly; this is purely a manual-process
 * signal, since nothing in the code can detect a law changing on its own).
 * Deliberately separate from checkRegulatoryContentReviewDue(), which has
 * notification side effects and only returns overdue rows — this returns
 * every row's status, overdue or not, with no side effects.
 */
export interface RegulatoryContentReviewStatus {
  jurisdiction: string;
  lastReviewedAt: string;
  daysSinceReview: number;
  isOverdue: boolean;
  /** This row's own cadence in days — either its real override, or the global default it's currently falling back to. Shown on /queue so a reviewer can see WHY a jurisdiction like DIFC goes overdue sooner than the rest. */
  cadenceDays: number;
}

export async function listRegulatoryContentReviewStatus(): Promise<RegulatoryContentReviewStatus[]> {
  const supabase = createAdminClient();
  const globalCadenceDays = await getSettingNumber("regulatory_content_review_days", 180);

  const { data: rows, error } = await supabase
    .from("regulatory_content_reviews")
    .select("jurisdiction, last_reviewed_at, review_cadence_days")
    .order("jurisdiction");
  if (error) throw new Error(`listRegulatoryContentReviewStatus: failed to load review rows: ${error.message}`);

  const now = Date.now();
  return (rows ?? []).map((r) => {
    const cadenceDays = (r.review_cadence_days as number | null) ?? globalCadenceDays;
    const daysSinceReview = Math.floor((now - new Date(r.last_reviewed_at).getTime()) / (24 * 60 * 60 * 1000));
    return {
      jurisdiction: r.jurisdiction as string,
      lastReviewedAt: r.last_reviewed_at as string,
      daysSinceReview,
      isOverdue: daysSinceReview >= cadenceDays,
      cadenceDays,
    };
  });
}
