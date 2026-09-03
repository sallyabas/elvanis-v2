import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadActivePendingEvidenceSubmission } from "@/lib/evidence/pending-submission";
import { SUBMISSION_STAGE_LABELS } from "@/lib/evidence/submission-status";
import { loadPaymentRecords, type PaymentEntityType, type PaymentRecord } from "@/lib/reviewer/payment-records";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { TypeBadge, moduleTypeToItemType, sessionTypeToItemType } from "@/lib/item-type-badge";
import { humanizeStatus, SESSION_STATUS_LABELS } from "@/lib/format";
import { Card } from "@/app/_components/ui/Card";
import { Input } from "@/app/_components/ui/Input";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import { setPilotClientAction, setPaymentRecordAction } from "./actions";

/**
 * One shared payment-status row, reused across every payable item on this
 * page (confirmed 2026-08-25, direct founder request) — see
 * payment-records.ts's own docblock for why this is one shared table, not
 * a column bolted onto four different tables.
 */
function PaymentStatusRow({
  companyId,
  entityType,
  entityId,
  record,
}: {
  companyId: string;
  entityType: PaymentEntityType;
  entityId: string;
  record: PaymentRecord | undefined;
}) {
  return (
    <form action={setPaymentRecordAction.bind(null, companyId, entityType, entityId)} className="mt-1 flex flex-wrap items-center gap-1.5">
      <Select name="status" defaultValue={record?.status ?? "not_applicable"} className="w-28 py-1 text-xs">
        <option value="not_applicable">N/A</option>
        <option value="unpaid">Unpaid</option>
        <option value="invoiced">Invoiced</option>
        <option value="paid">Paid</option>
      </Select>
      <Input name="amount" type="number" placeholder="£ amount" defaultValue={record?.amount ?? ""} className="w-24 py-1 text-xs" />
      <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
        Update
      </Button>
    </form>
  );
}

// Real reviewer company-context view (confirmed 2026-08-11, live testing
// pass) — closes a real gap found live: the Session Requests panel on
// /queue showed only a company name and a date, with no way to see who
// this actually is or what they've submitted before deciding whether/how
// to follow up. Auth/role gating handled entirely by (reviewer)/layout.tsx
// (this route sits inside that group), same pattern as every other
// reviewer-only page — no redundant check needed here.
//
// Deliberately scoped small: this is a single-company detail view, not
// the broader "browsable admin dashboard of everything" idea flagged
// separately (see CLAUDE.md) — built because this specific need (context
// for a session request) called for it, not as a first step toward that
// bigger, not-yet-confirmed piece of scope.
export default async function ReviewerCompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const admin = createAdminClient();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select(
      "id, name, industry, business_model, employee_count, stage, website_url, revenue_range_band, customer_type, team_structure_summary, registration_country, customer_market_countries, is_pilot_client",
    )
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) notFound();

  const { data: goals } = await admin
    .from("goals")
    .select("id, primary_goal, secondary_goal, urgency_level, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const { data: reports } = await admin
    .from("reports")
    .select("id, status, submitted_at, delivered_at, rerun_of_report_id")
    .eq("company_id", companyId)
    .order("submitted_at", { ascending: false });

  const { data: moduleRequests } = await admin
    .from("module_requests")
    .select("id, module_type, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  // All requests for this company (confirmed 2026-08-25, direct founder
  // request) — sessions/Concierge and Execution Sprints, alongside the
  // Core Audit reports and module requests already shown above.
  const { data: sessionRequests } = await admin
    .from("session_requests")
    .select("id, session_type, status, requested_at, scheduled_at, completed_at, phone_snapshot")
    .eq("company_id", companyId)
    .order("requested_at", { ascending: false });

  const { data: executionSprints } = await admin
    .from("execution_sprints")
    .select("id, status, start_date, target_end_date, report_id")
    .eq("company_id", companyId)
    .order("id", { ascending: false });

  // Real basic visibility for "Does this apply to us?" feedback (confirmed
  // 2026-09-03, direct founder request) — this data was genuinely
  // write-only before now: submitFindingNotApplicableFeedback() inserts a
  // row, and the only prior read (loadFlaggedFindingIds()) exists purely
  // to re-render the SAME client's own button state on reload, never
  // surfaced to any reviewer. finding_title is stored verbatim on the row
  // itself (confirmed by reading the migration directly), so this is a
  // single-table query — no join back to lens_findings/module_findings
  // needed. Extended here rather than a new standalone page — genuinely
  // low-volume data, same reasoning already applied to payment records
  // and regulatory-content-review status living on existing pages instead
  // of new ones.
  const { data: findingFeedback } = await admin
    .from("finding_feedback")
    .select("id, finding_source, finding_title, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  // Payment status (confirmed 2026-08-25) — only paid re-audits carry a
  // real payment record among reports; module requests, sessions, and
  // sprints are all real, priced items regardless.
  const paidReportIds = (reports ?? []).filter((r) => r.rerun_of_report_id !== null).map((r) => r.id as string);
  const [reportPayments, modulePayments, sessionPayments, sprintPayments] = await Promise.all([
    loadPaymentRecords("report", paidReportIds),
    loadPaymentRecords("module_request", (moduleRequests ?? []).map((m) => m.id as string)),
    loadPaymentRecords("session_request", (sessionRequests ?? []).map((s) => s.id as string)),
    loadPaymentRecords("execution_sprint", (executionSprints ?? []).map((s) => s.id as string)),
  ]);

  const activePendingSubmission = await loadActivePendingEvidenceSubmission(companyId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/queue" className="mb-4 inline-block text-sm text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200">
        ← Back to queue
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{company.name}</h1>

      <div className="space-y-6">
        {/* Real, reviewer-set flag (confirmed 2026-08-24) — feeds the
            automated pilot testimonial/referral ask on delivery. Not
            auto-derived (see the migration's own docblock for why). */}
        <Card title="Pilot client">
          <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
            {company.is_pilot_client
              ? "Marked as a pilot client — testimonial/referral asks fire on every delivery for this company."
              : "Not marked as a pilot client — only the general feedback ask fires on delivery."}
          </p>
          <form action={setPilotClientAction.bind(null, company.id as string, !company.is_pilot_client)}>
            <Button variant="secondary" className="px-2 py-1 text-xs">
              {company.is_pilot_client ? "Unmark as pilot client" : "Mark as pilot client"}
            </Button>
          </form>
        </Card>

        <Card title="Business profile">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                ["Industry", company.industry],
                ["Business model", company.business_model],
                ["Stage", company.stage],
                ["Employee count", company.employee_count],
                ["Revenue band", company.revenue_range_band],
                ["Customer type", company.customer_type],
                ["Website", company.website_url],
                ["Registration country", company.registration_country],
                ["Customer markets", (company.customer_market_countries as string[] | null)?.join(", ")],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
                <dd className={value ? "text-neutral-800 dark:text-neutral-200" : "italic text-neutral-400"}>{value || "Not provided"}</dd>
              </div>
            ))}
            {company.team_structure_summary && (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500 dark:text-neutral-400">Team structure</dt>
                <dd className="text-neutral-800 dark:text-neutral-200">{company.team_structure_summary}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title="Goal">
          {goals && goals.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {goals.map((g) => (
                <li key={g.id} className="text-neutral-800 dark:text-neutral-200">
                  <span className="font-medium">{GOAL_LABELS[g.primary_goal as PrimaryGoal] ?? g.primary_goal}</span>
                  {g.secondary_goal && (
                    <span className="text-neutral-500 dark:text-neutral-400"> · also: {GOAL_LABELS[g.secondary_goal as PrimaryGoal] ?? g.secondary_goal}</span>
                  )}
                  {g.urgency_level && <span className="text-neutral-500 dark:text-neutral-400"> · urgency: {g.urgency_level}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No goal set yet.</p>
          )}
        </Card>

        <Card title="Current evidence status">
          {activePendingSubmission ? (
            <p className="text-sm text-neutral-800 dark:text-neutral-200">
              {SUBMISSION_STAGE_LABELS[activePendingSubmission.stage]}
              {activePendingSubmission.stage === "editing" && (
                <span className="text-neutral-500 dark:text-neutral-400"> · edit window closes {new Date(activePendingSubmission.editWindowClosesAt).toLocaleString()}</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No evidence submission currently in progress.</p>
          )}
        </Card>

        <Card title="Core Audit reports">
          {reports && reports.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {reports.map((r) => {
                const isPaidReAudit = r.rerun_of_report_id !== null;
                return (
                  <li key={r.id} className="border-b border-neutral-100 pb-2 last:border-0 last:pb-0 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="flex flex-wrap items-center gap-2 text-neutral-800 dark:text-neutral-200">
                        <TypeBadge type="core_audit" />
                        {humanizeStatus(r.status as string)} · submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}
                        {r.delivered_at && <> · delivered {new Date(r.delivered_at).toLocaleDateString()}</>}
                        {isPaidReAudit && <span className="text-xs text-neutral-500 dark:text-neutral-400">(paid re-audit)</span>}
                      </span>
                      <Link href={`/review/${r.id}`} className="text-xs font-medium text-accent hover:underline">
                        Open
                      </Link>
                    </div>
                    {/* Only paid re-audits carry a real payment record — a
                        first, free audit has nothing to pay. */}
                    {isPaidReAudit && (
                      <PaymentStatusRow companyId={companyId} entityType="report" entityId={r.id as string} record={reportPayments.get(r.id as string)} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No reports yet.</p>
          )}
        </Card>

        <Card title="Module requests">
          {moduleRequests && moduleRequests.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {moduleRequests.map((m) => (
                <li key={m.id} className="border-b border-neutral-100 pb-2 last:border-0 last:pb-0 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-2 text-neutral-800 dark:text-neutral-200">
                      <TypeBadge type={moduleTypeToItemType(m.module_type as string)} />
                      {humanizeStatus(m.status as string)} · {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                    </span>
                    <Link href={`/review-module/${m.id}`} className="text-xs font-medium text-accent hover:underline">
                      Open
                    </Link>
                  </div>
                  <PaymentStatusRow companyId={companyId} entityType="module_request" entityId={m.id as string} record={modulePayments.get(m.id as string)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No module requests yet.</p>
          )}
        </Card>

        {/* Sessions & Concierge requests, and Execution Sprints (confirmed
            2026-08-25, direct founder request) — closes the real gap: this
            page previously only showed Core Audit reports and module
            requests, not the full picture of every request type for this
            company. */}
        <Card title="Sessions & Concierge requests">
          {sessionRequests && sessionRequests.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {sessionRequests.map((s) => (
                <li key={s.id} className="border-b border-neutral-100 pb-2 last:border-0 last:pb-0 dark:border-neutral-800">
                  <span className="flex flex-wrap items-center gap-2 text-neutral-800 dark:text-neutral-200">
                    <TypeBadge type={sessionTypeToItemType(s.session_type as string)} />
                    {SESSION_STATUS_LABELS[s.status as string] ?? humanizeStatus(s.status as string)} · requested{" "}
                    {s.requested_at ? new Date(s.requested_at).toLocaleDateString() : "—"}
                    {s.scheduled_at && <> · scheduled {new Date(s.scheduled_at).toLocaleString()}</>}
                    {s.completed_at && <> · completed {new Date(s.completed_at).toLocaleDateString()}</>}
                  </span>
                  {/* Phone snapshot (confirmed 2026-09-03) — the number on file at request time, not a live profile reference. */}
                  {s.phone_snapshot && <p className="text-xs text-neutral-500 dark:text-neutral-400">Phone: {s.phone_snapshot as string}</p>}
                  <PaymentStatusRow companyId={companyId} entityType="session_request" entityId={s.id as string} record={sessionPayments.get(s.id as string)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No session or Concierge requests yet.</p>
          )}
        </Card>

        {/* Real basic visibility for "Does this apply to us?" feedback
            (confirmed 2026-09-03) — see the finding_feedback query above
            for the full "this was write-only before now" context. */}
        <Card title="Finding feedback" subtitle={'Client-flagged "Does this apply to us?" responses.'}>
          {findingFeedback && findingFeedback.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {findingFeedback.map((row) => (
                <li key={row.id} className="border-b border-neutral-100 pb-2 last:border-0 last:pb-0 dark:border-neutral-800">
                  <span className="text-neutral-800 dark:text-neutral-200">{row.finding_title as string}</span>
                  <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                    ({row.finding_source === "module_finding" ? "module finding" : "core audit finding"}) · flagged{" "}
                    {new Date(row.created_at as string).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No findings flagged &quot;doesn&apos;t apply&quot; yet.</p>
          )}
        </Card>

        <Card title="Execution Sprints">
          {executionSprints && executionSprints.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {executionSprints.map((s) => (
                <li key={s.id} className="border-b border-neutral-100 pb-2 last:border-0 last:pb-0 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-2 text-neutral-800 dark:text-neutral-200">
                      <TypeBadge type="execution_sprint" />
                      {humanizeStatus(s.status as string)}
                      {s.start_date && <> · started {s.start_date}</>}
                      {s.target_end_date && <> · target end {s.target_end_date}</>}
                    </span>
                    <Link href={`/review-sprint/${s.id}`} className="text-xs font-medium text-accent hover:underline">
                      Open
                    </Link>
                  </div>
                  <PaymentStatusRow companyId={companyId} entityType="execution_sprint" entityId={s.id as string} record={sprintPayments.get(s.id as string)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No Execution Sprints yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
