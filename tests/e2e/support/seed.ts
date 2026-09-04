import { createTestAdminClient } from "./db";
import { freshTestEmail } from "./testEmail";
import type { LensFinding } from "@/lib/lenses/types";

/**
 * Seeds a real, reviewable report for the item-6 E2E test (reviewer
 * approval -> delivery -> client views delivered report) — confirmed
 * 2026-09-02, direct founder decision: seed findings directly rather than
 * run a real Groq audit, since this test verifies the reviewer
 * Accept/Edit/Reject/Approve/Deliver workspace and the client's delivered-
 * report view, not the AI pipeline itself (which already has its own
 * extensive, separate proof throughout this codebase's history).
 *
 * Interpretation note, disclosed rather than assumed: the requested fourth
 * finding ("one Article 4 AI literacy finding") is, in the real app, a
 * Tender-Readiness-MODULE-specific deterministic guarantee
 * (`buildArticle4LiteracyFinding()`), not part of the five core lenses this
 * test exercises (`reports`/`lens_findings`, the core-audit reviewer
 * workspace). Seeding it as a literal Tender Readiness module finding would
 * mean testing a second, separate reviewer workspace
 * (`/review-module/[id]`) that item 6's own description ("a real reviewer
 * approval -> delivery cycle, client viewing their delivered report") does
 * not otherwise mention. Seeded here instead as a real `ai_governance`-lens
 * finding whose content mirrors the same real concern (no AI literacy
 * training for staff using AI tools) — satisfying the requested severity/
 * content mix without silently expanding this test into a second workflow.
 * Flag this back if a literal Tender Readiness module test was intended
 * instead.
 */
export interface SeededReviewFixture {
  clientEmail: string;
  reviewerEmail: string;
  companyId: string;
  companyName: string;
  reportId: string;
  findingIds: { critical: string; high: string; medium: string; aiLiteracy: string };
}

/**
 * Minimal real client + company + goal, no report — confirmed 2026-09-02.
 * Used by the sidebar-navigation spec, which only needs a real,
 * already-onboarded account to reach every page from; it isn't re-testing
 * onboarding itself (that's specs 2-4's job), so driving the full wizard
 * here would just be redundant setup cost.
 */
export async function seedMinimalClient(): Promise<{ email: string; companyId: string }> {
  const supabase = createTestAdminClient();
  const email = freshTestEmail("nav");

  const { data: auth, error: authError } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (authError || !auth.user) throw new Error(`seed: create auth user failed: ${authError?.message}`);

  const { error: userRowError } = await supabase.from("users").upsert({ id: auth.user.id, email, role: "client" }, { onConflict: "id" });
  if (userRowError) throw new Error(`seed: upsert users row failed: ${userRowError.message}`);

  // Real redirect-loop bug found and fixed 2026-09-04 (full-platform E2E
  // re-test): entry_path was never set here, leaving it NULL — a state
  // the real onboarding flow never produces (createCompanyAndGoal()
  // always sets a real value), but (app)/layout.tsx's gate treats a
  // falsy entry_path as "not onboarded" while /onboarding's own fallback
  // used to treat any existing company as "done," creating an actual
  // infinite redirect loop between the two routes. Set explicitly here to
  // match what a genuinely fully-onboarded test company should have —
  // this fixture is meant to reach Dashboard directly, not the Hub
  // picker.
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ user_id: auth.user.id, name: `Playwright Nav Co ${Date.now()}`, privacy_acknowledged_at: new Date().toISOString(), entry_path: "diagnosis" })
    .select("id")
    .single();
  if (companyError || !company) throw new Error(`seed: create company failed: ${companyError?.message}`);

  const { error: goalError } = await supabase.from("goals").insert({ company_id: company.id, primary_goal: "cash_flow_margin_efficiency" });
  if (goalError) throw new Error(`seed: create goal failed: ${goalError.message}`);

  return { email, companyId: company.id as string };
}

export async function seedReviewableReport(): Promise<SeededReviewFixture> {
  const supabase = createTestAdminClient();

  const clientEmail = freshTestEmail("client-review");
  const reviewerEmail = freshTestEmail("reviewer");
  const companyName = `Playwright Review Co ${Date.now()}`;

  // Real, confirmed-email auth accounts — same admin.createUser({email_confirm:
  // true}) pattern as scripts/grant-reviewer.ts, so no real email round-trip
  // is needed for either role.
  const { data: clientAuth, error: clientAuthError } = await supabase.auth.admin.createUser({
    email: clientEmail,
    email_confirm: true,
  });
  if (clientAuthError || !clientAuth.user) throw new Error(`seed: create client auth user failed: ${clientAuthError?.message}`);

  const { data: reviewerAuth, error: reviewerAuthError } = await supabase.auth.admin.createUser({
    email: reviewerEmail,
    email_confirm: true,
  });
  if (reviewerAuthError || !reviewerAuth.user) throw new Error(`seed: create reviewer auth user failed: ${reviewerAuthError?.message}`);

  const { error: clientRowError } = await supabase
    .from("users")
    .upsert({ id: clientAuth.user.id, email: clientEmail, role: "client" }, { onConflict: "id" });
  if (clientRowError) throw new Error(`seed: upsert client users row failed: ${clientRowError.message}`);

  const { error: reviewerRowError } = await supabase
    .from("users")
    .upsert({ id: reviewerAuth.user.id, email: reviewerEmail, role: "reviewer" }, { onConflict: "id" });
  if (reviewerRowError) throw new Error(`seed: upsert reviewer users row failed: ${reviewerRowError.message}`);

  // Same real redirect-loop fix as seedMinimalClient() above — entry_path
  // must be set, or the client-facing half of this fixture (visiting
  // /reports/[id], /evidence-intake, etc., all inside the (app) route
  // group) hits an infinite redirect loop instead of reaching the real
  // page under test.
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ user_id: clientAuth.user.id, name: companyName, privacy_acknowledged_at: new Date().toISOString(), entry_path: "diagnosis" })
    .select("id")
    .single();
  if (companyError || !company) throw new Error(`seed: create company failed: ${companyError?.message}`);

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .insert({ company_id: company.id, primary_goal: "cash_flow_margin_efficiency" })
    .select("id")
    .single();
  if (goalError || !goal) throw new Error(`seed: create goal failed: ${goalError?.message}`);

  const now = Date.now();
  const submittedAt = new Date(now - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
  const editWindowClosesAt = new Date(now - 60 * 60 * 1000).toISOString(); // closed 1h ago — clears approveReport's gate

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      company_id: company.id,
      goal_id: goal.id,
      status: "pending_review",
      submitted_at: submittedAt,
      edit_window_closes_at: editWindowClosesAt,
    })
    .select("id")
    .single();
  if (reportError || !report) throw new Error(`seed: create report failed: ${reportError?.message}`);

  const baseFinding = (overrides: Partial<LensFinding> & Pick<LensFinding, "title" | "diagnosis" | "rootCause" | "recommendedAction" | "severity">): LensFinding => ({
    findingId: "", // real id assigned once persisted; unused by ai_draft itself
    evidenceCited: ["seeded for E2E testing — see tests/e2e/support/seed.ts"],
    goalRelevance: "directly_affects",
    financialImpact: null,
    confidenceLevel: "high",
    isMissingDataFinding: false,
    ...overrides,
  });

  const findings: { lens: string; ai_draft: LensFinding }[] = [
    {
      lens: "financial",
      ai_draft: baseFinding({
        title: "Critical Customer Revenue Concentration",
        diagnosis: "Top customer accounts for 61% of ARR — well above the 35% critical concentration threshold.",
        rootCause: "No structured account-diversification effort has run alongside this customer's growth.",
        recommendedAction: "Prioritize new-logo acquisition and contractually cap any single customer's revenue share.",
        severity: "critical",
        financialImpact: {
          impactBandLow: 40000,
          impactBandHigh: 120000,
          currency: "GBP",
          confidenceLevel: "medium",
          assumptions: ["Estimated cost of a sudden churn event from this single customer, based on current ARR."],
        },
      }),
    },
    {
      lens: "execution",
      ai_draft: baseFinding({
        title: "PR Review Pickup Time Above Benchmark",
        diagnosis: "Pull requests sit a median of 14 hours before first review, versus a 4-hour healthy benchmark.",
        rootCause: "No on-call reviewer rotation exists — review pickup depends on whoever notices first.",
        recommendedAction: "Introduce a daily reviewer rotation with a same-day pickup SLA.",
        severity: "high",
      }),
    },
    {
      lens: "product",
      ai_draft: baseFinding({
        title: "Core Feature Adoption Below Healthy Range",
        diagnosis: "Core feature adoption sits at 38%, below the 45% top-quartile benchmark.",
        rootCause: "Onboarding does not actively route new users toward the core feature.",
        recommendedAction: "Add an in-app onboarding step that surfaces the core feature in the first session.",
        severity: "medium",
      }),
    },
    {
      lens: "ai_governance",
      ai_draft: baseFinding({
        title: "No AI Literacy Training for Staff Using AI Tools",
        diagnosis: "Staff use AI tools in day-to-day work with no structured training on safe, appropriate use.",
        rootCause: "AI tool adoption happened organically, ahead of any governance or training program.",
        recommendedAction: "Stand up a short, mandatory AI literacy training covering safe use, limitations, and escalation.",
        severity: "high",
      }),
    },
  ];

  const { data: insertedFindings, error: findingsError } = await supabase
    .from("lens_findings")
    .insert(
      findings.map((f) => ({
        company_id: company.id,
        report_id: report.id,
        lens: f.lens,
        ai_draft: f.ai_draft,
        confidence_level: f.ai_draft.confidenceLevel,
        is_missing_data_finding: false,
      })),
    )
    .select("id, lens");
  if (findingsError || !insertedFindings) throw new Error(`seed: insert findings failed: ${findingsError?.message}`);

  const idByLens = Object.fromEntries(insertedFindings.map((f) => [f.lens, f.id])) as Record<string, string>;

  // Real gap found live, not assumed: run-audit.ts is the only writer of
  // reports.top_3_finding_ids in the real app, and this fixture never goes
  // through run-audit.ts — a real reviewer pass in the actual reviewer
  // workspace has its own separate re-rank action for this, but this spec
  // doesn't drive that UI (it's not part of what item 6 asked to verify).
  // Without it, the client's delivered-report page correctly renders zero
  // "Top 3 priorities" section (resolveTop3FindingsInOrder() has nothing to
  // resolve), which is exactly what happened on the first real run of this
  // spec. Seeded directly here instead, matching this fixture's own
  // "seed directly via script" design for everything else — critical +
  // high + the AI-literacy finding, leaving the medium finding as the one
  // real non-top-3 item.
  const { error: top3Error } = await supabase
    .from("reports")
    .update({ top_3_finding_ids: [idByLens.financial, idByLens.execution, idByLens.ai_governance] })
    .eq("id", report.id);
  if (top3Error) throw new Error(`seed: set top_3_finding_ids failed: ${top3Error.message}`);

  return {
    clientEmail,
    reviewerEmail,
    companyId: company.id as string,
    companyName,
    reportId: report.id as string,
    findingIds: {
      critical: idByLens.financial,
      high: idByLens.execution,
      medium: idByLens.product,
      aiLiteracy: idByLens.ai_governance,
    },
  };
}

/**
 * A genuinely healthy, already-delivered report — confirmed 2026-09-05,
 * combinatorial coverage pass (the "report health" axis: "at least one
 * clearly healthy company"). Seeded directly rather than run through a
 * real reviewer pass — that workspace UI is already proven by
 * seedReviewableReport()'s own consumer (spec 6); this fixture exists
 * purely to exercise the CLIENT-facing rendering of a healthy report
 * (Strengths by lens, no alarm-style top-priority framing), so it's
 * created already `sent`, with `reviewed_by`/`approved_at`/`delivered_at`
 * set directly to satisfy the DB's `reports_sent_requires_reviewer` check
 * constraint without a live reviewer session.
 */
export async function seedHealthyDeliveredReport(): Promise<{ clientEmail: string; companyId: string; companyName: string; reportId: string }> {
  const supabase = createTestAdminClient();

  const clientEmail = freshTestEmail("healthy-client");
  const reviewerEmail = freshTestEmail("healthy-reviewer");
  const companyName = `Playwright Healthy Co ${Date.now()}`;

  const { data: clientAuth, error: clientAuthError } = await supabase.auth.admin.createUser({ email: clientEmail, email_confirm: true });
  if (clientAuthError || !clientAuth.user) throw new Error(`seed: create healthy client auth failed: ${clientAuthError?.message}`);
  const { data: reviewerAuth, error: reviewerAuthError } = await supabase.auth.admin.createUser({ email: reviewerEmail, email_confirm: true });
  if (reviewerAuthError || !reviewerAuth.user) throw new Error(`seed: create healthy reviewer auth failed: ${reviewerAuthError?.message}`);

  await supabase.from("users").upsert({ id: clientAuth.user.id, email: clientEmail, role: "client" }, { onConflict: "id" });
  await supabase.from("users").upsert({ id: reviewerAuth.user.id, email: reviewerEmail, role: "reviewer" }, { onConflict: "id" });

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      user_id: clientAuth.user.id,
      name: companyName,
      privacy_acknowledged_at: new Date().toISOString(),
      entry_path: "diagnosis",
      industry: "B2B SaaS",
    })
    .select("id")
    .single();
  if (companyError || !company) throw new Error(`seed: create healthy company failed: ${companyError?.message}`);

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .insert({ company_id: company.id, primary_goal: "product_delivery" })
    .select("id")
    .single();
  if (goalError || !goal) throw new Error(`seed: create healthy goal failed: ${goalError?.message}`);

  const now = new Date();
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      company_id: company.id,
      goal_id: goal.id,
      status: "sent",
      submitted_at: now.toISOString(),
      edit_window_closes_at: now.toISOString(),
      reviewed_by: reviewerAuth.user.id,
      approved_at: now.toISOString(),
      delivered_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (reportError || !report) throw new Error(`seed: create healthy report failed: ${reportError?.message}`);

  const healthyFindings = [
    {
      lens: "financial",
      title: "Gross Margin Comfortably Above Healthy Range",
      diagnosis: "Gross margin is 82%, well above the 70-80% healthy range for this business model.",
    },
    {
      lens: "execution",
      title: "PR Review Pickup Time Well Within Benchmark",
      diagnosis: "Pull requests are picked up for review within 2 hours on average, against a 4-hour healthy benchmark.",
    },
    {
      lens: "product",
      title: "Core Feature Adoption Above Top-Quartile Benchmark",
      diagnosis: "Core feature adoption sits at 58%, above the 45% top-quartile benchmark.",
    },
  ];

  const { error: findingsError } = await supabase.from("lens_findings").insert(
    healthyFindings.map((f) => ({
      company_id: company.id,
      report_id: report.id,
      lens: f.lens,
      ai_draft: {
        findingId: "",
        title: f.title,
        diagnosis: f.diagnosis,
        rootCause: "Sustained, deliberate investment in this area over multiple quarters.",
        recommendedAction: "Maintain current practice; no corrective action needed.",
        severity: "low",
        evidenceCited: ["seeded for E2E testing — see tests/e2e/support/seed.ts"],
        goalRelevance: "directly_supports",
        financialImpact: null,
        confidenceLevel: "high",
        isMissingDataFinding: false,
      },
      confidence_level: "high",
      reviewer_status: "approved",
      is_missing_data_finding: false,
    })),
  );
  if (findingsError) throw new Error(`seed: insert healthy findings failed: ${findingsError.message}`);

  return { clientEmail, companyId: company.id as string, companyName, reportId: report.id as string };
}
