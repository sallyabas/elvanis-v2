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

const SESSION_LABELS: Record<string, string> = { discovery: "Discovery Session", delivery: "Delivery Session", f2f_workshop: "F2F Workshop" };
const SESSION_STATUS_LABELS: Record<string, string> = { requested: "Requested — awaiting scheduling", scheduled: "Scheduled", completed: "Completed", declined: "Declined" };

interface HistoryItem {
  id: string;
  label: string;
  subLabel: string | null;
  date: string | null;
  dateLabel: string;
  href: string | null;
}

// Reports & History — chronological, frozen-snapshot archive of every
// generated report (confirmed 2026-08-04, Priority 3): the core audit plus
// all three standalone modules, session-derived. Extended 2026-08-15
// (Dashboard/module fixes review) to also carry session requests and
// Execution Sprints — a real, necessary companion to that same pass's
// Dashboard "Active status" tightening: once Dashboard stopped showing
// terminal items (delivered modules, completed/declined sessions, complete
// sprints) and Discovery Sessions in any state, this page had to actually
// pick them up or they'd vanish from the client's view entirely rather
// than simply moving to the right place. Comparison-over-time is
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

  // Session requests — real rule, confirmed 2026-08-15: a Discovery Session
  // lives here in ANY state (requested/scheduled/completed/declined), since
  // it never shows on Dashboard at all (see dashboard/page.tsx's own
  // docblock for why). Every other session type (Delivery, F2F Workshop)
  // only lands here once it's reached a terminal state (completed/
  // declined) — while requested/scheduled, it's genuinely active and
  // already shown on Dashboard instead; showing it in both places would be
  // real duplication, not "more complete history."
  const { data: allSessionRequests } = await supabase
    .from("session_requests")
    .select("id, session_type, status, requested_at, scheduled_at, completed_at")
    .eq("company_id", company.id)
    .order("requested_at", { ascending: false });
  const historicalSessionRequests = (allSessionRequests ?? []).filter(
    (r) => r.session_type === "discovery" || r.status === "completed" || r.status === "declined",
  );

  // Execution Sprints — only `complete` (terminal) lands here; `scoped`/
  // `in_progress` stay Dashboard-only, same reasoning as module requests
  // above (non-terminal = Dashboard's job, terminal = History's job).
  const { data: completeSprints } = await supabase
    .from("execution_sprints")
    .select("id, signed_off_at, target_end_date")
    .eq("company_id", company.id)
    .eq("status", "complete")
    .order("signed_off_at", { ascending: false, nullsFirst: false });

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
      subLabel: null,
      date: r.delivered_at as string | null,
      dateLabel: "Delivered",
      href: `/reports/${r.id}`,
    })),
    ...(moduleRequests ?? []).map((r) => ({
      id: r.id as string,
      label: MODULE_LABELS[r.module_type as string] ?? (r.module_type as string),
      subLabel: null,
      date: r.delivered_at as string | null,
      dateLabel: "Delivered",
      // Real gap closed (confirmed 2026-08-15, real bug list item #6) — a
      // real client-facing detail view now exists; this previously showed
      // "Detail view coming soon" with no link at all.
      href: `/services/module/${r.id}`,
    })),
    ...historicalSessionRequests.map((r) => {
      const date = (r.completed_at as string | null) ?? (r.scheduled_at as string | null) ?? (r.requested_at as string | null);
      const dateLabel = r.completed_at ? "Completed" : r.scheduled_at ? "Scheduled" : "Requested";
      return {
        id: r.id as string,
        label: SESSION_LABELS[r.session_type as string] ?? (r.session_type as string),
        subLabel: SESSION_STATUS_LABELS[r.status as string] ?? (r.status as string),
        date,
        dateLabel,
        // No dedicated client-facing session detail page exists yet — same
        // "real, deliberately deferred follow-on scope" precedent as
        // module results before their own detail view was built.
        href: null,
      };
    }),
    ...(completeSprints ?? []).map((s) => ({
      id: s.id as string,
      label: "Execution Sprint",
      subLabel: "Complete",
      date: (s.signed_off_at as string | null) ?? (s.target_end_date as string | null),
      dateLabel: s.signed_off_at ? "Signed off" : "Target end",
      href: `/execution-sprint/${s.id}`,
    })),
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <ProgressStepper journeyStatus={journeyStatus} />
      <h1 className="mb-1 text-2xl font-semibold">Reports &amp; History</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Every report, module result, session, and completed sprint, in one chronological list.
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
                <div className="font-medium text-neutral-900 dark:text-neutral-50">
                  {item.label}
                  {item.subLabel && <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">{item.subLabel}</span>}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {item.dateLabel} {item.date ? new Date(item.date).toLocaleDateString() : "unknown"}
                </div>
              </div>
              {item.href && (
                <Link href={item.href} className="text-sm underline">
                  View
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
