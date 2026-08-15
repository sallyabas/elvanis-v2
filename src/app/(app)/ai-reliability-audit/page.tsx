import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettingNumber } from "@/lib/app-settings";
import { AiReliabilityIntakeForm } from "./AiReliabilityIntakeForm";

/**
 * Real root cause found in production 2026-08-15 (see tender-readiness's
 * page.tsx for the full writeup) — same fix applied here: a real,
 * synchronous Groq call with no `maxDuration` configured risks being
 * killed by the platform's default serverless timeout mid-flight.
 */
export const maxDuration = 60;

// AI Reliability Audit — standalone entry page, sellable independent of the
// core audit. See spec §1.7a for the confirmed design (evidence-based, no
// live execution, system-type-branching intake).
//
// Moved into the (app) route group 2026-08-15 (real bug found and fixed,
// module intake/service flow review) — same fix, same reasoning as
// Tender Readiness's own page.tsx: this page had no site nav and trusted
// an unauthenticated `?companyId=` query param with no session check,
// even though real client auth has existed app-wide since 2026-08-03.
// Now fully session-derived, never trusted from a query param.
export default async function AiReliabilityAuditPage() {
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

  const reviewPeriodHours = await getSettingNumber("review_period_hours", 48);

  return <AiReliabilityIntakeForm companyId={company.id as string} reviewPeriodHours={reviewPeriodHours} />;
}
