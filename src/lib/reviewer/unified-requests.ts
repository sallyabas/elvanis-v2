import { createAdminClient } from "@/lib/supabase/admin";
import type { Severity } from "@/lib/lenses/types";

/**
 * Unified, filterable request list (confirmed 2026-08-25, direct founder
 * request) — one normalized view across every request type this app
 * tracks (Core Audit reports, standalone module requests, session/
 * Concierge requests, Execution Sprints), replacing the need to check
 * separate sections (Ready for review, Session requests, Sprint queue)
 * individually. Deliberately NOT a new table or a materialized view —
 * this reads the same source tables every other reviewer page already
 * reads, normalized in application code, since the four source shapes
 * are genuinely different (a session request has no severity; a report
 * has no "scheduled_at") and forcing them into one schema at the DB
 * layer would either lose real fields or need a lot of always-null
 * columns.
 *
 * Severity is only meaningful for audits/modules (they have findings);
 * sessions/sprints get `severity: null`, filtered out entirely by a
 * severity filter rather than mis-represented as "low". Severity per
 * audit/module is the single HIGHEST severity among its own
 * approved/edited findings — the same "worst case, not an average"
 * reasoning already used for isFixFirstCandidate()/next-priority.ts's own
 * SEVERITY_RANK, kept as a local copy here since that one isn't exported.
 */

export type UnifiedRequestType = "audit" | "module" | "session" | "sprint";

export interface UnifiedRequestRow {
  id: string;
  type: UnifiedRequestType;
  typeLabel: string;
  companyId: string;
  companyName: string;
  /** The single date this row sorts/filters by — submitted_at / created_at / requested_at, whichever is this row's own real anchor moment. */
  date: string | null;
  status: string;
  severity: Severity | null;
  link: string;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const MODULE_LABELS: Record<string, string> = {
  ai_reliability: "AI Reliability Audit",
  tender_readiness: "Tender Readiness",
  data_protection: "Data Protection Compliance",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  discovery: "Discovery Session",
  delivery: "Delivery Session",
  f2f_workshop: "F2F Workshop",
  concierge_inquiry: "Concierge inquiry",
};

interface FindingLike {
  ai_draft: { severity?: Severity } | null;
  reviewer_edited_content: { severity?: Severity } | null;
  reviewer_status: string;
}

function highestSeverity(findings: FindingLike[]): Severity | null {
  let best: Severity | null = null;
  for (const f of findings) {
    if (f.reviewer_status === "rejected") continue;
    const content = f.reviewer_edited_content ?? f.ai_draft;
    const severity = content?.severity;
    if (!severity) continue;
    if (!best || SEVERITY_RANK[severity] > SEVERITY_RANK[best]) best = severity;
  }
  return best;
}

function companyNameOf(row: { companies: unknown }): string {
  return (row.companies as { name: string } | null)?.name ?? "Unknown company";
}

export async function loadUnifiedRequests(): Promise<UnifiedRequestRow[]> {
  const admin = createAdminClient();

  const [{ data: reports }, { data: moduleRequests }, { data: sessionRequests }, { data: sprints }] = await Promise.all([
    admin.from("reports").select("id, company_id, status, submitted_at, companies(name)").order("submitted_at", { ascending: false }),
    admin.from("module_requests").select("id, company_id, module_type, status, created_at, companies(name)").order("created_at", { ascending: false }),
    admin
      .from("session_requests")
      .select("id, company_id, session_type, status, requested_at, companies(name)")
      .order("requested_at", { ascending: false }),
    admin.from("execution_sprints").select("id, company_id, status, start_date, report_id, companies(name)").order("start_date", { ascending: false }),
  ]);

  const reportIds = (reports ?? []).map((r) => r.id as string);
  const moduleIds = (moduleRequests ?? []).map((m) => m.id as string);

  const [{ data: allLensFindings }, { data: allModuleFindings }] = await Promise.all([
    reportIds.length > 0
      ? admin.from("lens_findings").select("report_id, ai_draft, reviewer_edited_content, reviewer_status").in("report_id", reportIds)
      : Promise.resolve({ data: [] as { report_id: string; ai_draft: unknown; reviewer_edited_content: unknown; reviewer_status: string }[] }),
    moduleIds.length > 0
      ? admin.from("module_findings").select("request_id, ai_draft, reviewer_edited_content, reviewer_status").in("request_id", moduleIds)
      : Promise.resolve({ data: [] as { request_id: string; ai_draft: unknown; reviewer_edited_content: unknown; reviewer_status: string }[] }),
  ]);

  const findingsByReport = new Map<string, FindingLike[]>();
  for (const f of allLensFindings ?? []) {
    const list = findingsByReport.get(f.report_id as string) ?? [];
    list.push(f as unknown as FindingLike);
    findingsByReport.set(f.report_id as string, list);
  }

  const findingsByModule = new Map<string, FindingLike[]>();
  for (const f of allModuleFindings ?? []) {
    const list = findingsByModule.get(f.request_id as string) ?? [];
    list.push(f as unknown as FindingLike);
    findingsByModule.set(f.request_id as string, list);
  }

  const rows: UnifiedRequestRow[] = [];

  for (const r of reports ?? []) {
    rows.push({
      id: r.id as string,
      type: "audit",
      typeLabel: "Core Audit",
      companyId: r.company_id as string,
      companyName: companyNameOf(r),
      date: r.submitted_at as string | null,
      status: r.status as string,
      severity: highestSeverity(findingsByReport.get(r.id as string) ?? []),
      link: `/review/${r.id}`,
    });
  }

  for (const m of moduleRequests ?? []) {
    rows.push({
      id: m.id as string,
      type: "module",
      typeLabel: MODULE_LABELS[m.module_type as string] ?? (m.module_type as string),
      companyId: m.company_id as string,
      companyName: companyNameOf(m),
      date: m.created_at as string | null,
      status: m.status as string,
      severity: highestSeverity(findingsByModule.get(m.id as string) ?? []),
      link: `/review-module/${m.id}`,
    });
  }

  for (const s of sessionRequests ?? []) {
    rows.push({
      id: s.id as string,
      type: "session",
      typeLabel: SESSION_TYPE_LABELS[s.session_type as string] ?? (s.session_type as string),
      companyId: s.company_id as string,
      companyName: companyNameOf(s),
      date: s.requested_at as string | null,
      status: s.status as string,
      severity: null,
      link: `/company/${s.company_id}`,
    });
  }

  for (const sp of sprints ?? []) {
    rows.push({
      id: sp.id as string,
      type: "sprint",
      typeLabel: "Execution Sprint",
      companyId: sp.company_id as string,
      companyName: companyNameOf(sp),
      date: sp.start_date as string | null,
      status: sp.status as string,
      severity: null,
      link: `/review-sprint/${sp.id}`,
    });
  }

  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return rows;
}
