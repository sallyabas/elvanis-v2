import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadActivePendingEvidenceSubmission } from "@/lib/evidence/pending-submission";
import { SUBMISSION_STAGE_LABELS } from "@/lib/evidence/submission-status";
import { Card } from "@/app/_components/ui/Card";

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
      "id, name, industry, business_model, employee_count, stage, website_url, revenue_range_band, customer_type, team_structure_summary, registration_country, customer_market_countries",
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
    .select("id, status, submitted_at, delivered_at")
    .eq("company_id", companyId)
    .order("submitted_at", { ascending: false });

  const { data: moduleRequests } = await admin
    .from("module_requests")
    .select("id, module_type, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const activePendingSubmission = await loadActivePendingEvidenceSubmission(companyId);

  const MODULE_LABELS: Record<string, string> = {
    ai_reliability: "AI Reliability Audit",
    tender_readiness: "Tender Readiness",
    data_protection: "Data Protection Compliance",
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/queue" className="mb-4 inline-block text-sm text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
        ← Back to queue
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{company.name}</h1>

      <div className="space-y-6">
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
                  <span className="font-medium">{g.primary_goal}</span>
                  {g.secondary_goal && <span className="text-neutral-500 dark:text-neutral-400"> · also: {g.secondary_goal}</span>}
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
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span className="text-neutral-800 dark:text-neutral-200">
                    {r.status} · submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}
                    {r.delivered_at && <> · delivered {new Date(r.delivered_at).toLocaleDateString()}</>}
                  </span>
                  <Link href={`/review/${r.id}`} className="text-xs underline">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No reports yet.</p>
          )}
        </Card>

        <Card title="Module requests">
          {moduleRequests && moduleRequests.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {moduleRequests.map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <span className="text-neutral-800 dark:text-neutral-200">
                    {MODULE_LABELS[m.module_type as string] ?? m.module_type} · {m.status} ·{" "}
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                  </span>
                  <Link href={`/review-module/${m.id}`} className="text-xs underline">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No module requests yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
