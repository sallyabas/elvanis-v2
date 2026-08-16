import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LensFinding, LensType } from "@/lib/lenses/types";
import { MODULE_META, type ModuleType } from "@/lib/modules/module-meta";
import { loadFlaggedFindingIds } from "@/lib/reports/finding-feedback";
import { SignalsClient, type SignalItem } from "./SignalsClient";

const LENS_LABELS: Record<LensType, string> = {
  financial: "Financial",
  commercial: "Commercial / Market",
  execution: "Execution / Operating",
  product: "Product / Customer",
  ai_governance: "AI & Governance",
};

interface GenericModuleFinding {
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: "critical" | "high" | "medium" | "low";
  isMissingDataFinding?: boolean;
  [key: string]: unknown;
}

function isValidEditedContent(v: unknown): v is GenericModuleFinding {
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).title === "string" && typeof (v as Record<string, unknown>).diagnosis === "string";
}

/**
 * Real, new Signals page (confirmed 2026-08-16, final Dashboard redesign
 * pass, item 1) — genuinely new value, not a duplicate of the existing
 * report/module detail views: a single, unified, filterable list of every
 * finding across the core audit's five lenses AND every delivered
 * standalone module (Tender Readiness, AI Reliability, Data Protection).
 * Nothing else in this app shows everything together in one place — the
 * client Report page only shows the core audit, and each module's own
 * detail page only shows that one module. Filtering (by lens/module,
 * severity) is client-side, over a small, already-loaded, per-client
 * dataset — no pagination/URL-param complexity needed at this scale.
 *
 * Scoped to the LATEST delivered core report (matching every other page's
 * "living record, not historical stack" treatment — Dashboard/Report both
 * already do the same) plus every delivered (status='sent') module
 * request, of any type, any age — a delivered module result doesn't get
 * superseded by a later one the way a re-audited core report does, so
 * showing all of them (not just the most recent) is the honest choice.
 */
export default async function SignalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company } = await supabase.from("companies").select("id, name").eq("user_id", user.id).maybeSingle();
  if (!company) {
    redirect("/onboarding");
  }
  const companyId = company.id as string;

  const { data: latestReport } = await supabase
    .from("reports")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const items: SignalItem[] = [];

  if (latestReport) {
    const { data: reportFindings } = await supabase
      .from("lens_findings")
      .select("id, lens, ai_draft, reviewer_edited_content, reviewer_status")
      .eq("report_id", latestReport.id);
    for (const row of reportFindings ?? []) {
      if (row.reviewer_status !== "approved" && row.reviewer_status !== "edited") continue;
      const content = (row.reviewer_edited_content ?? row.ai_draft) as LensFinding;
      items.push({
        id: row.id as string,
        source: "lens_finding",
        sourceKey: row.lens as string,
        sourceLabel: LENS_LABELS[row.lens as LensType] ?? (row.lens as string),
        title: content.title,
        diagnosis: content.diagnosis,
        recommendedAction: content.recommendedAction,
        severity: content.severity,
        isMissingDataFinding: content.isMissingDataFinding,
        financialImpact: content.financialImpact,
        detailHref: `/reports/${latestReport.id}`,
      });
    }
  }

  const { data: moduleRequests } = await supabase
    .from("module_requests")
    .select("id, module_type")
    .eq("company_id", companyId)
    .eq("status", "sent");

  for (const request of moduleRequests ?? []) {
    const { data: moduleFindings } = await supabase
      .from("module_findings")
      .select("id, ai_draft, reviewer_edited_content, reviewer_status, is_missing_data_finding")
      .eq("request_id", request.id)
      .in("reviewer_status", ["approved", "edited"]);
    const meta = MODULE_META[request.module_type as ModuleType];
    for (const row of moduleFindings ?? []) {
      const edited = row.reviewer_edited_content as GenericModuleFinding | null;
      const content = isValidEditedContent(edited) ? edited : (row.ai_draft as GenericModuleFinding);
      items.push({
        id: row.id as string,
        source: "module_finding",
        sourceKey: request.module_type as string,
        sourceLabel: meta?.label ?? (request.module_type as string),
        title: content.title,
        diagnosis: content.diagnosis,
        recommendedAction: content.recommendedAction,
        severity: content.severity,
        isMissingDataFinding: Boolean(row.is_missing_data_finding),
        financialImpact: null,
        detailHref: `/services/module/${request.id}`,
      });
    }
  }

  const flaggedIds = await loadFlaggedFindingIds(companyId);

  return <SignalsClient companyId={companyId} companyName={company.name as string} items={items} flaggedIds={[...flaggedIds]} />;
}
