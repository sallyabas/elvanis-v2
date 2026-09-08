import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeRegulatoryFrameworkStatus } from "@/lib/reviewer/regulatory-frameworks";
import { loadRequestsSummary, REQUEST_SERVICE_TYPE_LABELS, REQUEST_BUCKET_LABELS, REQUEST_BUCKET_ORDER, type RequestServiceType } from "@/lib/reviewer/requests-summary";
import { loadClientsSummary } from "@/lib/reviewer/clients-summary";
import { listIdeaBacklog } from "@/lib/reviewer/idea-backlog";
import { Card } from "@/app/_components/ui/Card";

/**
 * Reviewer Home page (confirmed 2026-09-08, final status-flow spec, item
 * 7) — a real, genuine dashboard/landing page, replacing /queue as the
 * post-login destination (see reviewer-login/actions.ts and page.tsx —
 * /queue itself is unchanged and still fully reachable from the
 * sidebar). Real widgets, not a placeholder:
 *   1. Top-of-page headline callout — "N awaiting payment, N overdue"
 *      style, the real executive-summary-first pattern already research-
 *      validated and built for the client-side Dashboard redesign,
 *      reused here rather than reinvented.
 *   2. Regulatory framework status — the exact summarizeRegulatory-
 *      FrameworkStatus() function moved here from the sidebar (removed
 *      entirely, confirmed 2026-09-08 — see ReviewerSidebar.tsx), which
 *      previously stood in for this page not existing yet.
 *   3. Requests widget — a real 7-bucket x 8-service-type breakdown, see
 *      requests-summary.ts's own extensive docblock for every confirmed
 *      design decision (Paid as an overlapping rollup, Overdue/Refunded
 *      correctly 0 where they don't apply, Core Audit split from
 *      re-audits).
 *   4. Clients widget — total + "recently active" (paid for a service or
 *      received a report specifically, not general login activity).
 *   5. Recent activity — a real, lightweight chronological feed (report
 *      delivered / module paid or delivered / sprint paid / session
 *      booked or completed), capped at 10, merged from real timestamped
 *      events across the tables this page already has real access to.
 *      Deliberately not its own dedicated module with a unit-tested pure
 *      function the way the Requests widget is — this is a plain fetch-
 *      sort-render, no branching logic complex enough to warrant that.
 *   6. Idea backlog count — a real, cheap glance at /ideas, open vs.
 *      total.
 *
 * The revenue rollup proactively suggested alongside these was explicitly
 * held for now, per direct confirmation — not built here.
 */
export default async function ReviewerHomePage() {
  const admin = createAdminClient();

  const [regulatorySummary, requestsSummary, clientsSummary, ideas] = await Promise.all([
    summarizeRegulatoryFrameworkStatus(),
    loadRequestsSummary(),
    loadClientsSummary(),
    listIdeaBacklog(),
  ]);
  const openIdeas = ideas.filter((i) => i.status !== "done" && i.status !== "declined").length;

  const [{ data: recentReports }, { data: recentModules }, { data: recentSprints }, { data: recentSessions }] = await Promise.all([
    admin.from("reports").select("company_id, delivered_at, companies(name)").eq("status", "sent").order("delivered_at", { ascending: false }).limit(10),
    admin
      .from("module_requests")
      .select("company_id, module_type, paid_at, delivered_at, companies(name)")
      .or("paid_at.not.is.null,delivered_at.not.is.null")
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("execution_sprints").select("company_id, paid_at, signed_off_at, companies(name)").not("paid_at", "is", null).order("paid_at", { ascending: false }).limit(10),
    admin
      .from("session_requests")
      .select("company_id, session_type, scheduled_at, completed_at, companies(name)")
      .in("status", ["scheduled", "completed"])
      .order("requested_at", { ascending: false })
      .limit(10),
  ]);

  type ActivityEvent = { at: string; companyName: string; description: string };
  const activity: ActivityEvent[] = [];
  for (const r of recentReports ?? []) {
    if (!r.delivered_at) continue;
    activity.push({ at: r.delivered_at as string, companyName: companyNameOf(r.companies), description: "Report delivered" });
  }
  for (const m of recentModules ?? []) {
    const label = (m.module_type as string).replace(/_/g, " ");
    if (m.delivered_at) activity.push({ at: m.delivered_at as string, companyName: companyNameOf(m.companies), description: `${label} delivered` });
    else if (m.paid_at) activity.push({ at: m.paid_at as string, companyName: companyNameOf(m.companies), description: `${label} — payment confirmed` });
  }
  for (const s of recentSprints ?? []) {
    if (s.paid_at) activity.push({ at: s.paid_at as string, companyName: companyNameOf(s.companies), description: "Execution Sprint — payment confirmed" });
  }
  for (const s of recentSessions ?? []) {
    const label = (s.session_type as string).replace(/_/g, " ");
    const at = (s.completed_at as string | null) ?? (s.scheduled_at as string | null);
    if (at) activity.push({ at, companyName: companyNameOf(s.companies), description: s.completed_at ? `${label} — completed` : `${label} — scheduled` });
  }
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const recentActivity = activity.slice(0, 10);

  const headlineParts: string[] = [];
  if (requestsSummary.byBucket.awaiting_payment > 0) headlineParts.push(`${requestsSummary.byBucket.awaiting_payment} awaiting payment`);
  if (requestsSummary.byBucket.overdue > 0) headlineParts.push(`${requestsSummary.byBucket.overdue} overdue`);
  if (requestsSummary.byBucket.under_review > 0) headlineParts.push(`${requestsSummary.byBucket.under_review} under review`);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Home</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">Everything worth a glance, in one place — the full detail still lives on /queue and /requests.</p>

      {headlineParts.length > 0 ? (
        <div className="mb-8 rounded-lg border-l-4 border-accent bg-accent/5 p-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
          {headlineParts.join(" · ")}
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Nothing awaiting payment, overdue, or under review right now.
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card title="Regulatory frameworks">
          <Link href="/admin/regulatory-frameworks" className="block text-sm hover:underline">
            <span className="text-emerald-600 dark:text-emerald-400">{regulatorySummary.green} current</span>
            {" · "}
            <span className="text-amber-600 dark:text-amber-400">{regulatorySummary.amber} due soon</span>
            {" · "}
            <span className="text-red-600 dark:text-red-400">{regulatorySummary.red} overdue</span>
          </Link>
        </Card>

        <Card title="Clients">
          <p className="text-sm text-neutral-800 dark:text-neutral-200">
            <span className="text-2xl font-semibold">{clientsSummary.totalClients}</span> total
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {clientsSummary.recentlyActiveClients} paid for a service or received a report in the last {clientsSummary.recentlyActiveWindowDays} days
          </p>
          <Link href="/companies" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            View all companies →
          </Link>
        </Card>

        <Card title="Ideas">
          <p className="text-sm text-neutral-800 dark:text-neutral-200">
            <span className="text-2xl font-semibold">{openIdeas}</span> open of {ideas.length} total
          </p>
          <Link href="/ideas" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            View idea backlog →
          </Link>
        </Card>

        <Card title="Recent activity">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              {recentActivity.map((e, i) => (
                <li key={i}>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{e.companyName}</span> — {e.description}
                  <span className="text-neutral-400 dark:text-neutral-500"> · {new Date(e.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Requests" subtitle="A real breakdown, not one summary number — buckets are NOT mutually exclusive (e.g. 'Paid' overlaps with 'Under Review'/'Completed')." className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="py-1.5 pr-3 font-medium text-neutral-500 dark:text-neutral-400">Service type</th>
                {REQUEST_BUCKET_ORDER.map((b) => (
                  <th key={b} className="px-2 py-1.5 text-right font-medium text-neutral-500 dark:text-neutral-400">
                    {REQUEST_BUCKET_LABELS[b]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(REQUEST_SERVICE_TYPE_LABELS) as RequestServiceType[]).map((serviceType) => (
                <tr key={serviceType} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-1.5 pr-3 font-medium text-neutral-800 dark:text-neutral-200">{REQUEST_SERVICE_TYPE_LABELS[serviceType]}</td>
                  {REQUEST_BUCKET_ORDER.map((b) => {
                    const count = requestsSummary.byServiceType[serviceType][b];
                    return (
                      <td key={b} className={`px-2 py-1.5 text-right ${count > 0 ? "font-medium text-neutral-800 dark:text-neutral-200" : "text-neutral-300 dark:text-neutral-700"}`}>
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="py-1.5 pr-3 font-semibold text-neutral-900 dark:text-neutral-50">Total</td>
                {REQUEST_BUCKET_ORDER.map((b) => (
                  <td key={b} className="px-2 py-1.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {requestsSummary.byBucket[b]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function companyNameOf(rel: unknown): string {
  const r = rel as { name: string } | { name: string }[] | null;
  return (Array.isArray(r) ? r[0]?.name : r?.name) ?? "Unknown company";
}
