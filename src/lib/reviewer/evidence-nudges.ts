import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";

/**
 * Evidence-completeness nudges (confirmed 2026-08-02): a `pending`
 * evidence_submission with no new activity for
 * app_settings.evidence_completeness_nudge_days (default 7) gets two
 * notifications — one to the client (encourage them to finish) and one to
 * every reviewer (visibility into a stalled submission), both
 * `event_type: "evidence_incomplete"`, differentiated by recipient_type.
 * "No new activity" is measured from the latest evidence_files row for
 * that submission, falling back to the submission's own created_at when no
 * files exist yet — evidence_submissions itself has no updated_at column.
 * Idempotent per stall period: won't re-nudge if the most recent nudge for
 * that submission is already newer than the last activity.
 */
export interface EvidenceNudgeFired {
  companyId: string;
  submissionId: string;
}

interface SubmissionRow {
  id: string;
  company_id: string;
  created_at: string;
  companies: { user_id: string } | { user_id: string }[] | null;
}

export async function checkEvidenceCompletenessNudges(): Promise<EvidenceNudgeFired[]> {
  const supabase = createAdminClient();
  const thresholdDays = await getSettingNumber("evidence_completeness_nudge_days", 7);
  const cutoffMs = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  const { data: submissions, error } = await supabase
    .from("evidence_submissions")
    .select("id, company_id, created_at, companies(user_id)")
    .eq("status", "pending");
  if (error) throw new Error(`checkEvidenceCompletenessNudges: failed to load submissions: ${error.message}`);

  const { data: reviewers, error: reviewersError } = await supabase.from("users").select("id").eq("role", "reviewer");
  if (reviewersError) throw new Error(`checkEvidenceCompletenessNudges: failed to load reviewers: ${reviewersError.message}`);

  const fired: EvidenceNudgeFired[] = [];

  for (const submission of (submissions ?? []) as SubmissionRow[]) {
    const company = Array.isArray(submission.companies) ? submission.companies[0] : submission.companies;
    if (!company) continue;

    const { data: latestFile } = await supabase
      .from("evidence_files")
      .select("created_at")
      .eq("evidence_submission_id", submission.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastActivityMs = new Date(latestFile?.created_at ?? submission.created_at).getTime();
    if (lastActivityMs > cutoffMs) continue;

    const { data: lastNudge } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("recipient_type", "client")
      .eq("recipient_id", company.user_id)
      .eq("event_type", "evidence_incomplete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastNudge && new Date(lastNudge.created_at).getTime() > lastActivityMs) continue;

    const { error: clientNotifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: company.user_id,
      event_type: "evidence_incomplete",
      channel: "email",
      sent_at: null,
    });
    if (clientNotifError) throw new Error(`checkEvidenceCompletenessNudges: failed to log client notification: ${clientNotifError.message}`);

    // Real perf fix (confirmed 2026-09-05, code-quality audit) — batched
    // insert instead of one per reviewer.
    if ((reviewers ?? []).length > 0) {
      const { error: reviewerNotifError } = await supabase.from("notifications").insert(
        (reviewers ?? []).map((reviewer) => ({
          recipient_type: "reviewer",
          recipient_id: reviewer.id,
          event_type: "evidence_incomplete",
          channel: "email",
          sent_at: null,
        })),
      );
      if (reviewerNotifError) throw new Error(`checkEvidenceCompletenessNudges: failed to log reviewer notification: ${reviewerNotifError.message}`);
    }

    fired.push({ companyId: submission.company_id, submissionId: submission.id });
  }

  return fired;
}
