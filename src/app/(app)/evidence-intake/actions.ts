"use server";

import { createClient } from "@/lib/supabase/server";
import type { EvidenceFieldInput } from "@/lib/lenses/types";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { MetricInput } from "@/lib/lenses/metrics";
import { clearEvidenceIntakeDraft } from "@/lib/evidence/draft";
import { upsertPendingEvidenceSubmission, claimPendingEvidenceSubmissionForImmediateAudit } from "@/lib/evidence/pending-submission";
import { runAuditForClaimedSubmission } from "@/lib/audit/run-pending-audits";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SubmitEvidenceInput {
  companyId: string;
  goalId: string;
  privacyAcknowledged: boolean;
  financial: { evidenceFields: EvidenceFieldInput[]; metrics: MetricInput[] };
  execution: { evidenceFields: EvidenceFieldInput[]; metrics: MetricInput[] };
  product: { evidenceFields: EvidenceFieldInput[]; metrics: MetricInput[] };
  commercial: CommercialSelfReport;
  aiGovernance: {
    hasLiveAiInProduction: boolean;
    governanceDocsSubmitted: boolean;
    questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
    governanceEvidence?: EvidenceFieldInput[];
  };
}

export interface SubmitEvidenceResult {
  success: boolean;
  error?: string;
}

/**
 * Delayed-execution evidence submission (rewritten 2026-08-10, direct
 * founder architecture request — see pending-submission.ts's own docblock
 * for the full "why"). This function used to call runAudit() directly and
 * synchronously here, which meant every resubmission during the 24h
 * "edit window" silently created a brand-new report and re-ran all five
 * lenses (real Groq cost) instead of updating anything in place — a real,
 * confirmed bug, not a design choice. Now it ONLY stores/updates the
 * evidence record; the audit runs exactly once, later, via the new cron
 * check once the window has closed (run-pending-audits.ts). No `reportId`
 * is returned anymore — none exists yet at submission time.
 *
 * Still uses the session's own RLS-respecting client to verify ownership
 * before ever writing anything — never trusts a client-supplied companyId
 * blindly, same discipline as every other write path in this codebase.
 * Company/goal PROFILE data (industry, primary_goal, etc.) is no longer
 * loaded here at all — there's no lens call to feed it to yet; the cron
 * processor loads the CURRENT profile fresh when the audit actually runs
 * (see load-profile.ts), same "living record, never cached" principle
 * already used everywhere else.
 */
export async function submitEvidence(input: SubmitEvidenceInput): Promise<SubmitEvidenceResult> {
  if (!input.privacyAcknowledged) {
    return { success: false, error: "You must accept the Privacy Policy and Terms of Service before submitting." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, privacy_acknowledged_at")
    .eq("id", input.companyId)
    .eq("user_id", user.id)
    .single();
  if (companyError || !company) return { success: false, error: "Company not found." };

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id")
    .eq("id", input.goalId)
    .eq("company_id", input.companyId)
    .single();
  if (goalError || !goal) return { success: false, error: "Goal not found." };

  // Privacy & Consent acknowledgment gate (spec §1.8, confirmed 2026-08-03)
  // — stamped here, at the actual point of first real evidence submission,
  // not at company creation. Only writes it the first time.
  if (!company.privacy_acknowledged_at) {
    await supabase.from("companies").update({ privacy_acknowledged_at: new Date().toISOString() }).eq("id", input.companyId);
  }

  // Keep the real, queryable companies.has_ai_in_production column current
  // (confirmed 2026-08-20, item 5 of the external-feedback batch) —
  // "captured once, read consistently everywhere" means this checkbox is
  // now also the mechanism that keeps the company-level living record in
  // sync, not just a per-submission answer. Deliberately does NOT touch
  // reports.source_evidence_snapshot's own copy of this value, which stays
  // a frozen, historical record of what was true for THIS specific audit.
  await supabase.from("companies").update({ has_ai_in_production: input.aiGovernance.hasLiveAiInProduction }).eq("id", input.companyId);

  const evidencePayload = {
    financial: input.financial,
    execution: input.execution,
    product: input.product,
    commercial: input.commercial,
    aiGovernance: input.aiGovernance,
  };

  const result = await upsertPendingEvidenceSubmission({
    companyId: input.companyId,
    goalId: input.goalId,
    evidencePayload,
  });
  if (!result.success) return { success: false, error: result.error };

  // Saved draft intake (confirmed 2026-08-05) — a successful submission
  // means there's no longer any in-progress state worth resuming from the
  // ephemeral draft; the pending_evidence_submissions row is now the real
  // record, and the form re-hydrates from THAT on a later visit instead.
  await clearEvidenceIntakeDraft(input.companyId);
  return { success: true };
}

export interface SubmitEvidenceNowResult {
  success: boolean;
  reportId?: string;
  error?: string;
}

/**
 * "Submit now, I'm done editing" fast-track (confirmed 2026-08-11, direct
 * founder request) — deliberately its own action, not a variant of
 * submitEvidence() above, since the two make genuinely different promises
 * to the client ("you'll have N hours to change your mind" vs. "this runs
 * right now and locks in immediately"). Reuses submitEvidence() itself for
 * the first step so nothing typed since the last save is silently lost:
 * whatever is currently in the form gets persisted exactly the same way a
 * normal submit would, THEN the submission is atomically claimed and run
 * immediately instead of waiting for the edit window to close naturally.
 *
 * The "only ever fire once" guarantee lives entirely in
 * claimPendingEvidenceSubmissionForImmediateAudit()'s conditional UPDATE,
 * not here — see that function's own docblock. This function is a thin
 * orchestrator: upsert, claim, run, report back. If the claim loses the
 * race (a cron tick grabbed the row microseconds earlier because the
 * window happened to close at the same moment), that's reported back
 * honestly as "already queued," not silently retried into a second run.
 */
export async function submitEvidenceNow(input: SubmitEvidenceInput): Promise<SubmitEvidenceNowResult> {
  const upsertResult = await submitEvidence(input);
  if (!upsertResult.success) return { success: false, error: upsertResult.error };

  const claim = await claimPendingEvidenceSubmissionForImmediateAudit(input.companyId);
  if (!claim.claimed) return { success: false, error: claim.error };

  const admin = createAdminClient();
  const outcome = await runAuditForClaimedSubmission(admin, {
    id: claim.row.id,
    company_id: input.companyId,
    goal_id: claim.row.goalId,
    evidence_payload: claim.row.evidencePayload,
    submitted_at: claim.row.submittedAt,
    edit_window_closes_at: claim.row.editWindowClosesAt,
  });

  if ("reportId" in outcome) {
    return { success: true, reportId: outcome.reportId };
  }
  return {
    success: false,
    error:
      "Your evidence was saved, but something went wrong starting the analysis. It's been queued for an automatic retry shortly — you don't need to resubmit.",
  };
}
