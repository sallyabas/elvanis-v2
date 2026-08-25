import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULE_META, type ModuleType } from "@/lib/modules/module-meta";
import { PROCUREMENT_QUESTIONS, type ProcurementCategory } from "@/lib/modules/tender-readiness/procurement-categories";
import { Card } from "@/app/_components/ui/Card";
import { Alert } from "@/app/_components/ui/Alert";
import { DeliveryFeedbackPrompt } from "@/app/_components/DeliveryFeedbackPrompt";
import { hasSubmittedFeedbackFor } from "@/lib/reviewer/delivery-feedback";

/**
 * Real client-facing module detail view (confirmed 2026-08-15, real bug
 * list item #6) — closes a gap flagged repeatedly and never actually
 * closed: Reports & History has shown "Detail view coming soon" for
 * every delivered module result since 2026-08-04, and nothing client-
 * facing ever replaced it. Deliberately session-scoped throughout, not
 * the admin client — module_requests/module_findings/procurement_answers'
 * own RLS policies (20260806090000_module_requests_rls_fix.sql) already
 * correctly restrict the owning client to `status = 'sent'` rows, so a
 * plain session-scoped query is both the simplest and the most secure
 * implementation: a request that isn't this client's own, or isn't
 * delivered yet, simply returns zero rows, not a bypassable check this
 * page has to get right itself.
 *
 * Findings/answers are still filtered to approved/edited in the
 * application query — RLS only gates on the PARENT request's status, not
 * each individual finding's own reviewer_status, so a rejected finding on
 * an otherwise-sent request would otherwise leak through. Same "never
 * show draft/rejected content to a client" discipline already applied to
 * the core-audit client Report page.
 */

interface GenericModuleFinding {
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: "critical" | "high" | "medium" | "low";
  isMissingDataFinding?: boolean;
  [key: string]: unknown;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

function isValidEditedContent(v: unknown): v is GenericModuleFinding {
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).title === "string" && typeof (v as Record<string, unknown>).diagnosis === "string";
}

export default async function ClientModuleDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: request } = await supabase
    .from("module_requests")
    .select("id, module_type, delivered_at, company_id, companies(is_pilot_client)")
    .eq("id", requestId)
    .eq("status", "sent")
    .maybeSingle();

  if (!request) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Alert variant="info">
          This result isn&apos;t available — either it hasn&apos;t been delivered yet, or it doesn&apos;t belong to your
          account.
        </Alert>
        <Link href="/reports" className="mt-4 inline-block text-sm font-medium text-accent underline hover:text-accent-hover">
          ← Back to Reports &amp; History
        </Link>
      </div>
    );
  }

  const moduleType = request.module_type as ModuleType;
  const meta = MODULE_META[moduleType];
  const isPilotClient = Boolean((request.companies as unknown as { is_pilot_client: boolean } | null)?.is_pilot_client);

  // Automated post-delivery feedback + pilot testimonial ask (confirmed
  // 2026-08-24, direct founder request) — same real submitted-state check
  // as the core-audit Report page, via related_module_request_id.
  const feedbackStatus = await hasSubmittedFeedbackFor(request.company_id as string, { moduleRequestId: request.id as string });

  const { data: findingRows } = await supabase
    .from("module_findings")
    .select("id, ai_draft, reviewer_edited_content, is_missing_data_finding")
    .eq("request_id", requestId)
    .in("reviewer_status", ["approved", "edited"])
    .order("created_at", { ascending: true });

  const findings = (findingRows ?? []).map((f) => {
    const edited = f.reviewer_edited_content as GenericModuleFinding | null;
    const content = isValidEditedContent(edited) ? edited : (f.ai_draft as GenericModuleFinding);
    return { id: f.id as string, isMissingDataFinding: Boolean(f.is_missing_data_finding), ...content };
  });

  let procurementAnswers: { id: string; category: ProcurementCategory; answer: string }[] = [];
  if (moduleType === "tender_readiness") {
    const { data: answerRows } = await supabase
      .from("procurement_answers")
      .select("id, category, ai_draft_answer, reviewer_edited_answer")
      .eq("request_id", requestId)
      .in("reviewer_status", ["approved", "edited"])
      .order("created_at", { ascending: true });
    procurementAnswers = (answerRows ?? []).map((a) => ({
      id: a.id as string,
      category: a.category as ProcurementCategory,
      answer: (a.reviewer_edited_answer as string | null) ?? (a.ai_draft_answer as string),
    }));
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">{meta?.label ?? moduleType}</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Delivered {request.delivered_at ? new Date(request.delivered_at as string).toLocaleDateString() : "recently"}.
      </p>

      <Card title="Findings" className="mb-8">
        {findings.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No findings to show.</p>
        ) : (
          <div className="space-y-3">
            {findings.map((f) => (
              <div
                key={f.id}
                className={
                  f.isMissingDataFinding
                    ? "rounded border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                    : "rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800"
                }
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-neutral-900 dark:text-neutral-50">{f.title}</span>
                  {f.isMissingDataFinding ? (
                    <span className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      No evidence submitted
                    </span>
                  ) : (
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[f.severity] ?? ""}`}>
                      {f.severity}
                    </span>
                  )}
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">{f.diagnosis}</p>
                {!f.isMissingDataFinding && (
                  <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">Recommended: </span>
                    {f.recommendedAction}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Real gap closed (confirmed 2026-08-15, real bug list item #4),
          copy rewritten again the same day (Dashboard/module fixes review)
          — the first version ("Draft answers... ready to adapt and share")
          explained what to DO with these, not what they actually ARE to a
          client who's never seen a procurement questionnaire. Rewritten to
          lead with what the questions mean for the client first. */}
      {moduleType === "tender_readiness" && procurementAnswers.length > 0 && (
        <Card title="Procurement answers">
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            These are the questions a customer or tender panel commonly asks to verify AI compliance before signing a
            contract or awarding a bid. Here&apos;s how we&apos;ve answered them on your behalf, based on your reviewed
            findings above — review and adapt before sharing.
          </p>
          <div className="space-y-4">
            {procurementAnswers.map((a) => (
              <div key={a.id} className="rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {PROCUREMENT_QUESTIONS[a.category]?.label ?? a.category}
                </p>
                <p className="mb-2 text-xs italic text-neutral-500 dark:text-neutral-400">{PROCUREMENT_QUESTIONS[a.category]?.question}</p>
                <p className="text-neutral-700 dark:text-neutral-300">{a.answer}</p>
              </div>
            ))}
          </div>
          {/* Evidence-pack download deliberately removed from the client
              view (confirmed 2026-08-15, direct founder rule) — a raw
              .md file isn't an appropriate client-facing deliverable; the
              findings and answers above already ARE the client-facing
              presentation of the same content. The download stays
              reviewer-only (ModuleReviewWorkspaceClient.tsx). The route
              itself keeps its owning-client authorization path from the
              prior round rather than being reverted, in case a real
              client-facing export format is built later — it's just no
              longer linked from anywhere a client can reach. */}
        </Card>
      )}

      {/* Automated post-delivery feedback + pilot testimonial ask
          (confirmed 2026-08-24, direct founder request) — same real
          mechanism as the core-audit Report page. */}
      <div className="mt-8 space-y-3">
        <DeliveryFeedbackPrompt companyId={request.company_id as string} feedbackType="general" relatedModuleRequestId={request.id as string} alreadySubmitted={feedbackStatus.general} />
        {isPilotClient && (
          <DeliveryFeedbackPrompt companyId={request.company_id as string} feedbackType="testimonial" relatedModuleRequestId={request.id as string} alreadySubmitted={feedbackStatus.testimonial} />
        )}
      </div>

      <Link href="/reports" className="mt-8 inline-block text-sm font-medium text-accent underline hover:text-accent-hover">
        ← Back to Reports &amp; History
      </Link>
    </div>
  );
}
