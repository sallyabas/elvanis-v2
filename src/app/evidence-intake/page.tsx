import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEvidenceIntakeDraft } from "@/lib/evidence/draft";
import { loadActivePendingEvidenceSubmission } from "@/lib/evidence/pending-submission";
import { evidencePayloadToDraft, type EvidencePayload } from "@/lib/evidence/draft-shape";
import { loadGovernanceDimensions } from "@/lib/lenses/benchmarks-repository";
import { getSettingNumber } from "@/lib/app-settings";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { ProgressStepper } from "@/app/_components/ProgressStepper";
import { computeJourneyStatus } from "@/lib/reports/journey-status";
import { SUBMISSION_STAGE_LABELS } from "@/lib/evidence/submission-status";
import { Card } from "@/app/_components/ui/Card";
import { Alert } from "@/app/_components/ui/Alert";
import { EvidenceIntakeForm } from "./EvidenceIntakeForm";

// Real Evidence Intake, fill-in-template path (confirmed 2026-08-03,
// Priority 1) — native CSV/PDF upload/parsing is explicitly deferred, see
// CLAUDE.md and spec §5. Session-derived company/goal, not `?companyId=`.
//
// Rewritten 2026-08-10 for the delayed-execution architecture — evidence
// submission no longer triggers runAudit() immediately (see
// pending-submission.ts's docblock for the full "why"). This page now
// gates on the company's active pending_evidence_submissions row, if any:
// still 'editing' → show the real form, pre-filled from the last real
// submission (not just the ephemeral autosave draft, which gets cleared
// on every successful submit); anything past 'editing' (queued for audit
// / audit in progress) → the evidence is locked, show status instead of a
// form that can't actually accept changes right now.
export default async function EvidenceIntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
  if (!company) {
    redirect("/onboarding");
  }
  const companyId = company.id as string;

  const { data: goal } = await supabase.from("goals").select("id").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!goal) {
    redirect("/onboarding");
  }

  const activeSubmission = await loadActivePendingEvidenceSubmission(companyId);

  const governanceDimensions = await loadGovernanceDimensions();

  const editWindowHours = await getSettingNumber("edit_window_hours", 24);
  const { data: priorSentReports } = await supabase.from("reports").select("id").eq("company_id", companyId).eq("status", "sent").limit(1);
  const isFreeAudit = (priorSentReports ?? []).length === 0;

  const journeyStatus = await computeJourneyStatus(createAdminClient(), companyId);

  // Locked view (confirmed 2026-08-10) — the client's evidence exists but
  // can no longer be changed right now: the window has closed and it's
  // either waiting for the scheduled audit run or actively being
  // analyzed. No form rendered at all in this state — there's nothing
  // coherent for the client to "submit" while it's locked.
  if (activeSubmission && activeSubmission.stage !== "editing") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ProgressStepper journeyStatus={journeyStatus} />
        <Card className="text-center">
          <h1 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            {SUBMISSION_STAGE_LABELS[activeSubmission.stage]}
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {activeSubmission.stage === "queued_for_audit"
              ? "The window for changes has closed. Your evidence is locked and waiting for the scheduled analysis run — check back shortly."
              : "Your evidence is being analyzed right now. This usually takes under a minute."}
          </p>
        </Card>
        {/* Real bug found and fixed (confirmed 2026-08-10, live testing pass)
            — this locked-status branch previously omitted the Discovery
            Session offer entirely, so it visibly disappeared the moment a
            client's evidence left "editing" and hit this view, even though
            it was correctly always present in the editable view below.
            Kept unconditional across every evidence-intake page state now.
            Deliberately NOT adding a link back to the evidence itself from
            here yet — flagged, founder's own call for later. */}
        <div className="mt-6">
          <SessionRequestButton companyId={companyId} sessionType="discovery" />
        </div>
      </div>
    );
  }

  // Draft priority (confirmed 2026-08-10): the ephemeral autosave draft
  // (mid-typing state since the last save) takes priority when present;
  // otherwise, if there's an active 'editing' submission, pre-fill from
  // the real last-submitted evidence — clearEvidenceIntakeDraft() already
  // wipes the draft on every successful submit, so without this fallback
  // a client returning to actually use their edit window would see a
  // blank form despite having real evidence on record.
  const rawDraft = await loadEvidenceIntakeDraft(companyId);
  const draft = rawDraft ?? (activeSubmission ? evidencePayloadToDraft(activeSubmission.evidencePayload as unknown as EvidencePayload) : null);

  // Informational note (confirmed 2026-08-10) — distinct from the locked
  // view above: this is the case where no submission is active for THIS
  // cycle, but a PRIOR cycle's report still exists and hasn't been
  // delivered yet (pending_review/approved). Submitting now is allowed
  // (starts a fresh cycle, per the existing re-audit principle) — this is
  // just honesty about what happens, not a block.
  const priorCycleInProgress = !activeSubmission && journeyStatus.stage === "in_review";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <ProgressStepper journeyStatus={journeyStatus} />
      <h1 className="mb-1 text-2xl font-semibold">Submit your evidence</h1>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        Fill in what you can for each area below — leaving something blank is meaningful too, not an incomplete
        submission.
      </p>
      {priorCycleInProgress && (
        <Alert variant="warning" className="mb-4">
          You have a report from an earlier submission still being reviewed. Submitting now starts a separate, new
          audit cycle rather than changing that one.
        </Alert>
      )}
      <div className="mb-8">
        <SessionRequestButton companyId={companyId} sessionType="discovery" />
      </div>
      <EvidenceIntakeForm
        companyId={companyId}
        goalId={goal.id as string}
        initialDraft={draft}
        governanceDimensions={governanceDimensions}
        editWindowHours={editWindowHours}
        isFreeAudit={isFreeAudit}
        isEditingExisting={activeSubmission !== null}
      />
    </div>
  );
}
