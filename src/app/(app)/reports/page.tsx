import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeJourneyStatus } from "@/lib/reports/journey-status";
import { NextStepBanner } from "@/app/_components/NextStepBanner";
import { ProgressStepper } from "@/app/_components/ProgressStepper";

const MODULE_LABELS: Record<string, string> = {
  ai_reliability: "AI Reliability Audit",
  tender_readiness: "Tender Readiness",
  data_protection: "Data Protection Compliance",
};

interface HistoryItem {
  id: string;
  label: string;
  deliveredAt: string | null;
  /** Null for module requests — no client-facing detail view exists for
   * them yet (only the internal reviewer workspace renders module
   * findings, which a client account can't reach). A real, separate gap
   * from "list them at all," not silently worked around by linking to a
   * route the client would just get bounced from. */
  href: string | null;
}

// Reports & History — chronological, frozen-snapshot archive of every
// generated report (confirmed 2026-08-04, Priority 3): the core audit plus
// all three standalone modules, session-derived. Comparison-over-time is
// explicitly V2 (spec §5), not built here. The Public Digital Presence
// Scan doesn't appear in this list — that feature doesn't exist yet
// (separately flagged, not part of this pass).
//
// Filtered to `status = 'sent'` for both core reports and module_requests,
// matching the intended "a client only sees it once actually delivered"
// principle. module_requests' own RLS policy previously allowed the owner
// to read any status, not just 'sent' — that real gap was fixed at the
// schema level 2026-08-06 (supabase/migrations/20260806090000_module_requests_rls_fix.sql),
// so this `.eq("status", "sent")` filter is now enforced by RLS itself too,
// not just this application-level query — belt and suspenders, matching
// `reports`' own pattern exactly.
export default async function ReportsHistoryPage() {
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

  const { data: reports } = await supabase
    .from("reports")
    .select("id, delivered_at")
    .eq("company_id", company.id)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false });

  const { data: moduleRequests } = await supabase
    .from("module_requests")
    .select("id, module_type, delivered_at")
    .eq("company_id", company.id)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false });

  // Real gap fixed, confirmed 2026-08-12 (live testing) — the empty state
  // here was a single bare, unstyled line ("Nothing delivered yet.") with
  // no visual weight and no next-step guidance, unlike Dashboard/Business
  // Profile/Evidence Intake, which all replaced the same class of gap with
  // NextStepBanner back on 2026-08-07. Same computeJourneyStatus() single
  // source of truth as those pages (admin client required — see that
  // function's own docblock for why a session-scoped query would silently
  // misreport an in-review company as no_evidence).
  const journeyStatus = await computeJourneyStatus(createAdminClient(), company.id as string);

  const items: HistoryItem[] = [
    ...(reports ?? []).map((r) => ({
      id: r.id as string,
      label: "Core Execution Audit",
      deliveredAt: r.delivered_at as string | null,
      href: `/reports/${r.id}`,
    })),
    ...(moduleRequests ?? []).map((r) => ({
      id: r.id as string,
      label: MODULE_LABELS[r.module_type as string] ?? (r.module_type as string),
      deliveredAt: r.delivered_at as string | null,
      href: null,
    })),
  ].sort((a, b) => new Date(b.deliveredAt ?? 0).getTime() - new Date(a.deliveredAt ?? 0).getTime());

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <ProgressStepper journeyStatus={journeyStatus} />
      <h1 className="mb-1 text-2xl font-semibold">Reports &amp; History</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Every report delivered to you, in one chronological list.
      </p>

      {items.length === 0 ? (
        <NextStepBanner journeyStatus={journeyStatus} />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <div className="font-medium text-neutral-900 dark:text-neutral-50">{item.label}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Delivered {item.deliveredAt ? new Date(item.deliveredAt).toLocaleDateString() : "unknown"}
                </div>
              </div>
              {item.href ? (
                <Link href={item.href} className="text-sm underline">
                  View
                </Link>
              ) : (
                <span className="text-xs text-neutral-400 dark:text-neutral-500">Detail view coming soon</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
