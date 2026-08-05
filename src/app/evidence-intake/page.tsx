import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Submit your evidence</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Fill in what you can for each area below — leaving something blank is meaningful too, not an incomplete
        submission.
      </p>
      <EvidenceIntakeForm companyId={company.id as string} goalId={goal.id as string} />
    </div>
  );
}
