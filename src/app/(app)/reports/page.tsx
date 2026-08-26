import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeJourneyStatus } from "@/lib/reports/journey-status";
import { NextStepBanner } from "@/app/_components/NextStepBanner";
import { ProgressStepper } from "@/app/_components/ProgressStepper";
import { Card } from "@/app/_components/ui/Card";

const SESSION_STATUS_LABELS: Record<string, string> = { requested: "Requested — awaiting scheduling", scheduled: "Scheduled", completed: "Completed", declined: "Declined" };

/**
 * Item-type identity, one per real thing this page can show (confirmed
 * 2026-08-26, full redesign — see the docblock below for the research this
 * was based on). Distinct from `group` — `type` drives the badge/color,
 * `group` drives which section the item renders in.
 *
 * "concierge" added after a real gap found live during this same pass:
 * `session_requests.session_type` has a 4th real value, `concierge_inquiry`
 * (added 2026-08-24, Concierge tier) — the pre-existing `SESSION_LABELS`
 * map on this page never had an entry for it either, but the original flat
 * list just fell back to the raw type string; a naive type→badge mapping
 * here would have actively mislabeled a completed/declined Concierge
 * inquiry as "F2F Workshop." Caught by testing against Sally's real
 * account, which has a real `concierge_inquiry` row, before this shipped.
 */
type ItemType =
  | "core_audit"
  | "tender_readiness"
  | "ai_reliability"
  | "data_protection"
  | "execution_sprint"
  | "discovery"
  | "delivery"
  | "f2f_workshop"
  | "concierge";

const TYPE_LABELS: Record<ItemType, string> = {
  core_audit: "Core Audit",
  tender_readiness: "Tender Readiness",
  ai_reliability: "AI Reliability Audit",
  data_protection: "Data Protection Compliance",
  execution_sprint: "Execution Sprint",
  discovery: "Discovery Session",
  delivery: "Delivery Session",
  f2f_workshop: "F2F Workshop",
  concierge: "Concierge Inquiry",
};

// One distinct color per type, so a client can tell items apart by glancing
// at the badge alone, not just by reading the title (confirmed 2026-08-26,
// direct founder request). Core Audit gets the real brand accent token
// (not a raw Tailwind amber utility) — it's the flagship product, and
// `accent` is already this app's own established "primary/flagship" signal
// (CTAs, primary buttons) — deliberately NOT the same raw amber-100/800
// pairing Signals/Dashboard already use for "medium severity", to avoid the
// two unrelated meanings reading as the same color. Every other type gets
// a genuinely distinct hue, avoiding red/orange (reserved for severity
// elsewhere in this app).
const TYPE_BADGE_STYLES: Record<ItemType, string> = {
  core_audit: "bg-accent text-accent-ink",
  tender_readiness: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  ai_reliability: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  data_protection: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  execution_sprint: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  discovery: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  delivery: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  f2f_workshop: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  concierge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
};

interface HistoryItem {
  id: string;
  type: ItemType;
  group: "deliverable" | "session";
  subLabel: string | null;
  date: string | null;
  dateLabel: string;
  href: string | null;
}

function TypeBadge({ type }: { type: ItemType }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_STYLES[type]}`}>{TYPE_LABELS[type]}</span>;
}

/**
 * Reports & History — full redesign (confirmed 2026-08-26), same
 * research-informed treatment as the Dashboard redesign. Real gap found in
 * the previous version: everything (Core Audit, 3 modules, Execution
 * Sprints, 3 session types — 8 distinct item types) rendered as one flat
 * list distinguished only by a plain-text label, no visual differentiation
 * at all.
 *
 * Checked real sources before deciding, not just opinion (same discipline
 * as the Dashboard pass): list-design and activity-feed guidance
 * consistently recommend (a) a consistent visual marker per item type so
 * mixed lists stay scannable "at a glance," and (b) grouping by category
 * when items are genuinely heterogeneous, while preserving chronological
 * order *within* each group when recency/audit-trail matters — this page's
 * own subtitle already promises a chronological record, so grouping
 * doesn't replace that, it sits on top of it. Sources:
 * https://www.uxpin.com/studio/blog/list-design/,
 * https://www.eleken.co/blog-posts/list-ui-design,
 * https://getstream.io/blog/activity-feed-design/,
 * https://uxpatterns.dev/patterns/data-display/timeline.
 *
 * Structure decided from that research:
 * 1. A colored type badge per item (see TYPE_BADGE_STYLES above) —
 *    chosen over a new icon set specifically to match this app's own
 *    already-established "colored badge as differentiator" pattern
 *    (severity badges, plan-tier badges, missing-evidence badges) rather
 *    than introducing a new icon library/dependency or hand-drawn SVGs for
 *    a genuinely new visual pattern this app doesn't otherwise use.
 * 2. Two real sections — "Deliverables" (Core Audit, the 3 modules,
 *    completed Execution Sprints: the actual substantive things Elvanis
 *    produced) and "Sessions" (Discovery/Delivery/F2F Workshop history) —
 *    replacing the one mixed list. This is the part of the redesign that
 *    most directly matches the founder's own framing ("real deliverables
 *    separated from session activity"). A section with zero items simply
 *    doesn't render its heading, rather than showing an empty group.
 * 3. Execution Sprints: confirmed present in both the code AND live
 *    rendering (see the verification note below) — the previous version's
 *    subtitle claim was accurate, not a stale promise.
 *
 * Everything else (RLS-enforced `status = 'sent'` filtering, the Discovery-
 * Session-shows-in-any-state rule, Digital Presence Scan's absence,
 * comparison-over-time being V2) is unchanged from the previous version —
 * this redesign only touches presentation, not what's included or why.
 */
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
  // `in_progress`/`proposed` stay Dashboard-only, same reasoning as module
  // requests above (non-terminal = Dashboard's job, terminal = History's
  // job). Confirmed 2026-08-26 this genuinely renders live, not just
  // present in code — see this file's own docblock.
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

  const deliverables: HistoryItem[] = [
    ...(reports ?? []).map((r) => ({
      id: r.id as string,
      type: "core_audit" as const,
      group: "deliverable" as const,
      subLabel: null,
      date: r.delivered_at as string | null,
      dateLabel: "Delivered",
      href: `/reports/${r.id}`,
    })),
    ...(moduleRequests ?? []).map((r) => ({
      id: r.id as string,
      type: (r.module_type === "ai_reliability" ? "ai_reliability" : r.module_type === "tender_readiness" ? "tender_readiness" : "data_protection") as ItemType,
      group: "deliverable" as const,
      subLabel: null,
      date: r.delivered_at as string | null,
      dateLabel: "Delivered",
      // Real gap closed (confirmed 2026-08-15, real bug list item #6) — a
      // real client-facing detail view now exists; this previously showed
      // "Detail view coming soon" with no link at all.
      href: `/services/module/${r.id}`,
    })),
    ...(completeSprints ?? []).map((s) => ({
      id: s.id as string,
      type: "execution_sprint" as const,
      group: "deliverable" as const,
      subLabel: "Complete",
      date: (s.signed_off_at as string | null) ?? (s.target_end_date as string | null),
      dateLabel: s.signed_off_at ? "Signed off" : "Target end",
      href: `/execution-sprint/${s.id}`,
    })),
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  const sessions: HistoryItem[] = historicalSessionRequests
    .map((r) => {
      const date = (r.completed_at as string | null) ?? (r.scheduled_at as string | null) ?? (r.requested_at as string | null);
      const dateLabel = r.completed_at ? "Completed" : r.scheduled_at ? "Scheduled" : "Requested";
      const type: ItemType =
        r.session_type === "discovery"
          ? "discovery"
          : r.session_type === "delivery"
            ? "delivery"
            : r.session_type === "concierge_inquiry"
              ? "concierge"
              : "f2f_workshop";
      return {
        id: r.id as string,
        type,
        group: "session" as const,
        subLabel: SESSION_STATUS_LABELS[r.status as string] ?? (r.status as string),
        date,
        dateLabel,
        // No dedicated client-facing session detail page exists yet — same
        // "real, deliberately deferred follow-on scope" precedent as
        // module results before their own detail view was built.
        href: null,
      };
    })
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  const isEmpty = deliverables.length === 0 && sessions.length === 0;

  function renderItem(item: HistoryItem) {
    return (
      <li
        key={item.id}
        className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TypeBadge type={item.type} />
            {item.subLabel && <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">{item.subLabel}</span>}
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
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <ProgressStepper journeyStatus={journeyStatus} />
      <h1 className="mb-1 text-2xl font-semibold">Reports &amp; History</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Every report, module result, and completed sprint you&apos;ve received, plus your session history — grouped
        so real deliverables and calls with your reviewer don&apos;t blur together.
      </p>

      {isEmpty ? (
        <NextStepBanner journeyStatus={journeyStatus} />
      ) : (
        <div className="space-y-8">
          {deliverables.length > 0 && (
            <Card title="Deliverables" subtitle="Real, reviewed output — your Core Audit, module results, and completed sprints.">
              <ul className="space-y-3">{deliverables.map(renderItem)}</ul>
            </Card>
          )}
          {sessions.length > 0 && (
            <Card title="Sessions" subtitle="Calls and workshops with your reviewer.">
              <ul className="space-y-3">{sessions.map(renderItem)}</ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
