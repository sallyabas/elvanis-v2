import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadEvidenceIntakeDraft } from "@/lib/evidence/draft";
import { loadGovernanceDimensions } from "@/lib/lenses/benchmarks-repository";
import { getSettingNumber } from "@/lib/app-settings";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { EvidenceIntakeForm } from "./EvidenceIntakeForm";

// Real Evidence Intake, fill-in-template path (confirmed 2026-08-03,
// Priority 1) — native CSV/PDF upload/parsing is explicitly deferred, see
// CLAUDE.md and spec §5. Session-derived company/goal, not `?companyId=`.
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

  const { data: goal } = await supabase.from("goals").select("id").eq("company_id", company.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!goal) {
    redirect("/onboarding");
  }

  // Saved draft intake (confirmed 2026-08-05, pulled forward from V2) —
  // resume any in-progress submission rather than starting blank every time.
  const draft = await loadEvidenceIntakeDraft(company.id as string);

  // GOVERNANCE_DIMENSIONS is now DB-backed (confirmed 2026-08-06) — fetched
  // here server-side and passed down as a prop, since EvidenceIntakeForm is
  // a client component that previously imported the (now DB-loaded, no
  // longer synchronously importable) constant directly. Same refactor
  // pattern queued for the recommendation library next.
  const governanceDimensions = await loadGovernanceDimensions();

  // Real confirmation modal (confirmed 2026-08-06) — closes the gap where
  // spec §2.3a's modal was only ever built in the demo prototype, never the
  // live flow. editWindowHours is read from the same app_settings row
  // run-audit.ts uses, so the modal's copy can never drift from the value
  // actually enforced. isFreeAudit is a real check (any already-`sent`
  // report for this company, RLS-scoped to the session — the same
  // `sent`-only policy the client report view relies on), not assumed.
  const editWindowHours = await getSettingNumber("edit_window_hours", 24);
  const { data: priorSentReports } = await supabase.from("reports").select("id").eq("company_id", company.id).eq("status", "sent").limit(1);
  const isFreeAudit = (priorSentReports ?? []).length === 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Submit your evidence</h1>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        Fill in what you can for each area below — leaving something blank is meaningful too, not an incomplete
        submission.
      </p>
      {/* SessionRequestButton is now a self-contained framed widget with its
          own explanatory copy (confirmed 2026-08-06, honest UX review) —
          no longer needs a bespoke wrapper paragraph duplicating what the
          component already renders. */}
      <div className="mb-8">
        <SessionRequestButton companyId={company.id as string} sessionType="discovery" />
      </div>
      <EvidenceIntakeForm
        companyId={company.id as string}
        goalId={goal.id as string}
        initialDraft={draft}
        governanceDimensions={governanceDimensions}
        editWindowHours={editWindowHours}
        isFreeAudit={isFreeAudit}
      />
    </div>
  );
}
