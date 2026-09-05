import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { loginAsTestUser } from "./support/auth";
import { createTestAdminClient } from "./support/db";
import { seedMinimalClient, seedReviewableReport, seedHealthyDeliveredReport } from "./support/seed";
import { step } from "./support/screenshot";
import { buildMinimalPdf, makeFixtureDir, writeFixture, REAL_DOCX_FIXTURES } from "./support/fixtures";

/** Spawns the real app function via a standalone tsx process — see backend-tasks.ts's own docblock for why this can't be a plain dynamic import from inside a Playwright spec. */
function runBackendTask(...args: string[]): unknown {
  const out = execFileSync("npx", ["tsx", "--env-file=.env.local", "tests/e2e/support/backend-tasks.ts", ...args], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop()!);
}

/**
 * Comprehensive combinatorial coverage pass (confirmed 2026-09-05) — not
 * re-testing individual flows already proven by specs 1-10 (onboarding,
 * sidebar nav, session lifecycle, overdue SLA, second opinion scaffolding
 * all stay their own specs); this file exists to vary jurisdiction, goal,
 * industry, report health, service combination, and document-upload state
 * TOGETHER, and to check the cross-cutting concerns (email dispatch,
 * Dashboard at every stage, reviewer queue, client finding interactions)
 * for each. A representative spread, not full permutation, per explicit
 * direction. No real Anthropic second-opinion calls anywhere in this file
 * — see playwright.config.ts's own webServer.env docblock, which already
 * guarantees this regardless of what this file does.
 */

async function setJurisdiction(
  companyId: string,
  registrationCountry: string | null,
  uaeFreeZone: "mainland" | "difc" | "adgm" | null,
  customerMarketCountries: string[],
) {
  const supabase = createTestAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ registration_country: registrationCountry, uae_free_zone: uaeFreeZone, customer_market_countries: customerMarketCountries })
    .eq("id", companyId);
  if (error) throw new Error(`setJurisdiction failed: ${error.message}`);
}

test.describe.configure({ mode: "serial" });

/**
 * Scopes an assertion to the real ApplicableRegulationsBox specifically
 * (its own eyebrow heading, "Which regulations apply to you, based on
 * your Business Profile") — a bare page-wide getByText() collides with
 * this same regulation's name also appearing in the page's own static
 * subtitle paragraph (e.g. Tender Readiness's subtitle literally lists
 * "EU AI Act (4-tier risk classification)..." as descriptive copy,
 * unconditional on what actually applies), a real strict-mode violation
 * found live on the first run of this test, not assumed away.
 */
function regBox(page: import("@playwright/test").Page) {
  return page.locator("section", { has: page.getByText("Which regulations apply to you", { exact: false }) });
}

test("Jurisdiction sweep: UK, EU, UAE mainland/ADGM/DIFC, Saudi, uncovered country, empty fields", async ({ page }, testInfo) => {
  const fixture = await seedMinimalClient();
  await loginAsTestUser(page, fixture.email);

  // --- Empty fields: quick-setup widget shown, "no jurisdiction applies" note, no "uncovered" warning (nothing is set, so nothing to flag as uncovered) ---
  await page.goto("/tender-readiness");
  await expect(page.getByText(/Why we're asking/i)).toBeVisible();
  await expect(regBox(page).getByText(/No AI-specific jurisdiction currently applies/i)).toBeVisible();
  await expect(page.getByText(/doesn't yet have built regulatory coverage/i)).not.toBeVisible();
  await step(page, testInfo, "11-combinatorial", "01-tr-empty-jurisdiction");

  // --- UK: known country, but UK-only registration + UK-only customers triggers no AI-specific regime on TR (EU AI Act needs EU customers; DIFC/Saudi need UAE/Saudi) — a real, meaningful negative case, distinct from "uncovered" ---
  await setJurisdiction(fixture.companyId, "United Kingdom", null, ["United Kingdom"]);
  await page.goto("/tender-readiness");
  await expect(regBox(page).getByText(/No AI-specific jurisdiction currently applies/i)).toBeVisible();
  await expect(page.getByText(/doesn't yet have built regulatory coverage/i)).not.toBeVisible();
  await page.goto("/data-protection-compliance");
  await expect(regBox(page).getByText(/UK GDPR/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "02-uk-known-but-no-ai-regime");

  // --- EU (Germany), multi-country customer markets: EU AI Act on TR, EU GDPR on DPC ---
  await setJurisdiction(fixture.companyId, "Germany", null, ["Germany", "France", "Netherlands"]);
  await page.goto("/tender-readiness");
  await expect(regBox(page).getByText(/EU AI Act/i)).toBeVisible();
  await page.goto("/data-protection-compliance");
  await expect(regBox(page).getByText(/EU GDPR/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "03-eu-multi-country");

  // --- UAE mainland: no DIFC-specific rule (registration-based only for DIFC), gets the non-binding UAE AI Charter reference ---
  await setJurisdiction(fixture.companyId, "United Arab Emirates", "mainland", ["United Arab Emirates"]);
  await page.goto("/tender-readiness");
  await expect(regBox(page).getByText(/UAE AI Charter/i)).toBeVisible();
  await expect(regBox(page).getByText(/UAE DIFC Regulation 10/i)).not.toBeVisible();
  await page.goto("/data-protection-compliance");
  await expect(regBox(page).getByText(/UAE( federal)? PDPL|Personal Data Protection Law/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "04-uae-mainland");

  // --- UAE ADGM: same as mainland on TR (no ADGM-specific AI rule), and no ADGM-specific data-protection rule on DPC (real, disclosed deferred scope) ---
  await setJurisdiction(fixture.companyId, "United Arab Emirates", "adgm", []);
  await page.goto("/tender-readiness");
  await expect(regBox(page).getByText(/UAE AI Charter/i)).toBeVisible();
  await expect(regBox(page).getByText(/UAE DIFC Regulation 10/i)).not.toBeVisible();
  await step(page, testInfo, "11-combinatorial", "05-uae-adgm");

  // --- UAE DIFC: DIFC Regulation 10 on TR (registration-based), DIFC Data Protection Law on DPC ---
  await setJurisdiction(fixture.companyId, "United Arab Emirates", "difc", []);
  await page.goto("/tender-readiness");
  await expect(regBox(page).getByText(/UAE DIFC Regulation 10/i)).toBeVisible();
  await page.goto("/data-protection-compliance");
  await expect(regBox(page).getByText(/DIFC Data Protection Law/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "06-uae-difc");

  // --- DIFC stable-arrangements question, real UI, on Business Profile ---
  await page.goto("/business-profile");
  await expect(page.getByText(/stable or contractual basis|ongoing or contractual/i)).toBeVisible();
  const difcSelect = page.locator("select").filter({ has: page.locator('option[value="not_sure"]') }).first();
  await difcSelect.selectOption("not_sure");
  await expect(page.getByRole("button", { name: /Request a Discovery Session/i })).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "07-difc-stable-arrangements-not-sure");

  // --- Saudi Arabia: Saudi AI governance on TR, Saudi PDPL on DPC ---
  await setJurisdiction(fixture.companyId, "Saudi Arabia", null, ["Saudi Arabia"]);
  await page.goto("/tender-readiness");
  await expect(regBox(page).getByText(/Saudi AI governance/i)).toBeVisible();
  await page.goto("/data-protection-compliance");
  await expect(regBox(page).getByText(/Saudi PDPL/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "08-saudi-arabia");

  // --- Deliberately uncovered country (Canada): "not covered" warning fires on both modules ---
  await setJurisdiction(fixture.companyId, "Canada", null, ["Canada"]);
  await page.goto("/tender-readiness");
  await expect(page.getByText(/doesn't yet have built regulatory coverage for Canada/i)).toBeVisible();
  await page.goto("/data-protection-compliance");
  await expect(page.getByText(/doesn't yet have built regulatory coverage for Canada/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "09-canada-uncovered");
});

test("Document upload states, all 3 modules on one company, Concierge inquiry (everything-at-once modules combo)", async ({ page }, testInfo) => {
  const fixture = await seedMinimalClient();
  await createTestAdminClient()
    .from("goals")
    .update({ primary_goal: "growth_revenue_efficiency" })
    .eq("company_id", fixture.companyId);
  await createTestAdminClient().from("companies").update({ industry: "FinTech" }).eq("id", fixture.companyId);
  await setJurisdiction(fixture.companyId, "United Kingdom", null, ["United Kingdom"]);

  const dir = makeFixtureDir();
  const validPdf = writeFixture(dir, "valid.pdf", buildMinimalPdf("Real compliance documentation covering our AI use, retention policy, and vendor risk assessment for the past year."));
  const insufficientPdf = writeFixture(dir, "insufficient.pdf", buildMinimalPdf("Hi"));
  const zeroByte = writeFixture(dir, "empty.pdf", Buffer.alloc(0));
  const invalidType = writeFixture(dir, "notes.txt", Buffer.from("this is plain text, not pdf or docx"));
  const oversized = writeFixture(dir, "oversized.pdf", Buffer.alloc(11 * 1024 * 1024, 1));

  await loginAsTestUser(page, fixture.email);
  await page.goto("/tender-readiness");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Describe the AI systems/i)).toBeVisible();

  const fileInput = page.locator('input[type="file"]');

  // 1. Invalid type -> generic rejection
  await fileInput.setInputFiles(invalidType);
  await expect(page.getByText(/Only PDF and DOCX files are supported/i)).toBeVisible({ timeout: 10_000 });

  // 2. Zero-byte .pdf -> "appears to be empty"
  await fileInput.setInputFiles(zeroByte);
  await expect(page.getByText(/appears to be empty/i)).toBeVisible({ timeout: 10_000 });

  // 3. Oversized -> client-side rejection, zero network POST for the upload action
  let uploadPostCount = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("tender-readiness")) uploadPostCount++;
  });
  await fileInput.setInputFiles(oversized);
  await expect(page.getByText(/too large.*11\.0MB/i)).toBeVisible({ timeout: 10_000 });
  expect(uploadPostCount).toBe(0);

  // 4. Insufficient content PDF -> "couldn't find readable text"
  await fileInput.setInputFiles(insufficientPdf);
  await expect(page.getByText(/couldn't find readable text/i)).toBeVisible({ timeout: 15_000 });

  // 5. Insufficient content DOCX (real mammoth fixture, 7 extractable chars) -> same near-empty message
  await fileInput.setInputFiles(REAL_DOCX_FIXTURES.insufficientContent);
  await expect(page.getByText(/couldn't find readable text/i)).toBeVisible({ timeout: 15_000 });

  // 6. Valid, sufficient-content DOCX (real mammoth fixture, 62 extractable chars) -> success, real text populates
  await fileInput.setInputFiles(REAL_DOCX_FIXTURES.sufficientContent);
  await expect(page.getByText(/Extracted text from/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Top left/)).toBeVisible();

  // 7. Valid, sufficient-content PDF (replaces the DOCX text just extracted) -> success
  await fileInput.setInputFiles(validPdf);
  await expect(page.getByText(/Extracted text from/i)).toBeVisible({ timeout: 15_000 });
  await step(page, testInfo, "11-combinatorial", "10-tr-document-states");

  // 8. Clear the textarea entirely -> "no upload at all" path, exercising the confirm-without-docs gate, then a real submission (module #1 of 3 on this company)
  const docTextarea = page.getByLabel(/Documentation text/i);
  await docTextarea.fill("");
  await page.getByLabel(/Describe the AI systems/i).fill("A customer support chatbot answering billing questions, built on a third-party LLM API.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/you don't have existing documentation/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Yes, continue without documentation" }).click();
  await expect(page.getByText(/Submitted for review/i)).toBeVisible({ timeout: 30_000 });
  await step(page, testInfo, "11-combinatorial", "11-tr-submitted-no-docs");

  // --- Module #2 of 3: Data Protection Compliance, with a real valid-PDF upload on its own shared document field (covers the "valid PDF upload on a different module" case too) ---
  await page.goto("/data-protection-compliance");
  await page.getByRole("button", { name: "Continue" }).click();
  const dpcFileInput = page.locator('input[type="file"]');
  await dpcFileInput.setInputFiles(validPdf);
  await expect(page.getByText(/Extracted text from/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Submitted for review/i)).toBeVisible({ timeout: 30_000 });
  await step(page, testInfo, "11-combinatorial", "12-dpc-submitted-with-pdf");

  // --- Module #3 of 3: AI Reliability Audit, agent/automation mode, hasTraceLogs=false (exercises the deterministic guaranteed finding), no document upload field on this module (confirmed by design) ---
  await page.goto("/ai-reliability-audit");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Agent / automation").click();
  await page.getByLabel(/What credentials\/permissions/i).fill("A shared internal service account with no per-run attribution.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Submitted for review/i)).toBeVisible({ timeout: 30_000 });
  await step(page, testInfo, "11-combinatorial", "13-ai-reliability-submitted");

  // --- Concierge inquiry on the same company (module + Concierge combo, and the "everything at once" modules+Concierge combo since this company now has all 3 modules) ---
  await page.goto("/services");
  await page.getByRole("button", { name: /Request Concierge/i }).click();
  await expect(page.getByText(/Concierge inquiry sent/i)).toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "11-combinatorial", "14-concierge-requested-everything-at-once");

  // --- Reviewer-side confirmation: all 3 module requests genuinely exist for this one company ---
  const supabase = createTestAdminClient();
  const { data: moduleRequests, error } = await supabase.from("module_requests").select("module_type").eq("company_id", fixture.companyId);
  expect(error).toBeNull();
  expect(new Set((moduleRequests ?? []).map((m) => m.module_type)).size).toBe(3);
});

test("Reviewer queue, Dashboard stages, client finding interactions, notifications, module+Execution Sprint combo", async ({ page }, testInfo) => {
  // Genuinely long, heavy test (a full reviewer accept/approve/deliver
  // cycle, three client interaction round-trips, two spawned tsx child
  // processes, and a real module submission) — the default 30s per-test
  // timeout was found live to be too tight against real local dev-server
  // load, not a symptom of an app bug (retried standalone and every step
  // completes correctly given enough time).
  test.setTimeout(120_000);
  const fixture = await seedReviewableReport();
  await createTestAdminClient().from("companies").update({ industry: "Healthcare Tech" }).eq("id", fixture.companyId);
  await createTestAdminClient().from("goals").update({ primary_goal: "churn_retention" }).eq("company_id", fixture.companyId);

  // --- Dashboard, "awaiting review" stage (report exists, not yet sent) ---
  await loginAsTestUser(page, fixture.clientEmail);
  await page.goto("/dashboard");
  await expect(page.getByText(/with your reviewer/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "15-dashboard-awaiting-review");

  // --- Reviewer queue: the company appears under "Ready for review" ---
  await loginAsTestUser(page, fixture.reviewerEmail);
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Ready for review" })).toBeVisible();
  await expect(page.getByText(fixture.companyName)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "16-reviewer-queue-ready-for-review");

  // --- Reviewer accepts every finding, approves, delivers (same real flow spec 6 already proves; re-driven here since this is a fresh report) ---
  await page.goto(`/review/${fixture.reportId}`);
  for (const title of [
    "Critical Customer Revenue Concentration",
    "PR Review Pickup Time Above Benchmark",
    "Core Feature Adoption Below Healthy Range",
    "No AI Literacy Training for Staff Using AI Tools",
  ]) {
    const row = page.locator("li", { hasText: title });
    await row.getByRole("button", { name: "Accept" }).click();
    await expect(row.getByText(/approved/i)).toBeVisible({ timeout: 10_000 });
  }
  await page.getByRole("button", { name: "Approve report" }).click();
  await expect(page.getByRole("button", { name: "Deliver report" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Deliver report" }).click();
  await expect(page.getByText(/delivered/i).first()).toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "11-combinatorial", "17-reviewer-delivered");

  // --- Dashboard, "has_report" stage ---
  await loginAsTestUser(page, fixture.clientEmail);
  await page.goto("/dashboard");
  await expect(page.getByText(/Here's what's holding/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "18-dashboard-has-report");

  // --- Client finding interactions: all 3 "Interested in help" choices, plus "Doesn't apply to us" ---
  // Scoped per finding by title, same convention spec 6 already uses for
  // the reviewer workspace's Accept/Edit buttons — a bare page-wide
  // getByText("Interested in help...") ordinal index is fragile (a real
  // strict-mode-adjacent bug found live on the first run of this test: the
  // click resolved, but against the wrong finding's button, since a
  // <p>text</p> node's own DOM-tree position doesn't reliably correspond
  // to visual reading order once the surrounding cards each carry
  // conditional siblings).
  await page.goto(`/reports/${fixture.reportId}`);
  // Real, disclosed test-writing lesson from this exact test's first run:
  // this finding's title appears on the page THREE times (the Top 3 list,
  // the 30/60/90 roadmap, and the finding's own per-lens card) — a plain
  // `locator("div", {has: getByText(title)})` matches every ancestor div
  // of EVERY occurrence, and `.last()` doesn't reliably resolve to the
  // one real finding-card div in that ambiguity. Scoped instead via XPath
  // to the nearest ancestor carrying the finding-card's own real
  // className marker ("rounded-lg", present on both the normal and
  // missing-data card variants, nowhere else near this text) — a single,
  // unambiguous match.
  const findingCard = (title: string) =>
    page.getByText(title, { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]").last();

  const criticalCard = findingCard("Critical Customer Revenue Concentration");
  await criticalCard.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(criticalCard.getByText(/Sent — your reviewer will follow up/i)).toBeVisible({ timeout: 20_000 });

  const highExecCard = findingCard("PR Review Pickup Time Above Benchmark");
  await highExecCard.getByRole("button", { name: "Not now" }).click();
  await expect(highExecCard.getByText(/Noted — no follow-up needed/i)).toBeVisible({ timeout: 20_000 });

  const highGovCard = findingCard("No AI Literacy Training for Staff Using AI Tools");
  await highGovCard.getByRole("button", { name: "Something else" }).click();
  await highGovCard.getByPlaceholder(/What would help/i).fill("Happy to discuss once we've reviewed internally first.");
  await highGovCard.getByRole("button", { name: "Send" }).click();
  await expect(highGovCard.getByText(/Sent — your reviewer will follow up/i)).toBeVisible({ timeout: 20_000 });

  await criticalCard.getByRole("button", { name: "Doesn't apply to us?" }).click();
  await expect(criticalCard.getByText(/Noted as not applicable/i)).toBeVisible({ timeout: 20_000 });
  await step(page, testInfo, "11-combinatorial", "19-client-finding-interactions");

  const supabase = createTestAdminClient();
  const { data: interestRows } = await supabase.from("sprint_interest_requests").select("response").eq("report_id", fixture.reportId);
  expect(new Set((interestRows ?? []).map((r) => r.response))).toEqual(new Set(["interested", "not_now", "other"]));
  const { data: feedbackRows } = await supabase.from("finding_feedback").select("id").eq("company_id", fixture.companyId);
  expect((feedbackRows ?? []).length).toBeGreaterThan(0);

  // --- Real notification dispatch: confirm the report_ready row created by deliverReport() actually sends (sent_at gets stamped), not just logged ---
  const { data: notifBefore } = await supabase
    .from("notifications")
    .select("id, sent_at")
    .eq("related_report_id", fixture.reportId)
    .eq("event_type", "report_ready");
  expect(notifBefore ?? []).not.toHaveLength(0);
  expect(notifBefore![0].sent_at).toBeNull();

  const dispatchResult = runBackendTask("dispatch-notifications") as { sent: number; failed: number; skippedByPreference: number };
  expect(dispatchResult.failed).toBeGreaterThanOrEqual(0); // real call completed without throwing, real JSON returned

  const { data: notifAfter } = await supabase
    .from("notifications")
    .select("sent_at")
    .eq("related_report_id", fixture.reportId)
    .eq("event_type", "report_ready")
    .single();
  expect(notifAfter?.sent_at).not.toBeNull();

  // --- Module + Execution Sprint combo: request a real module on this same company, and create+approve a real Execution Sprint from one of its approved findings ---
  const approveResult = runBackendTask("create-and-approve-sprint", fixture.reportId, fixture.findingIds.critical) as { approved: boolean };
  expect(approveResult.approved).toBe(true);

  await setJurisdiction(fixture.companyId, "United Kingdom", null, ["United Kingdom"]);
  await page.goto("/tender-readiness");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Describe the AI systems/i).fill("An internal churn-prediction model flagging at-risk accounts for the success team.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/you don't have existing documentation/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Yes, continue without documentation" }).click();
  await expect(page.getByText(/Submitted for review/i)).toBeVisible({ timeout: 30_000 });

  // --- Dashboard, "active sprint" stage, alongside a real module request (module + Execution Sprint combo, on the same company) ---
  await page.goto("/dashboard");
  await expect(page.getByText(/Execution Sprint/i).first()).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "20-dashboard-active-sprint-plus-module");
});

test("Healthy company: Strengths by lens renders real ratios, no alarm-style top-priority framing", async ({ page }, testInfo) => {
  const fixture = await seedHealthyDeliveredReport();
  await loginAsTestUser(page, fixture.clientEmail);

  await page.goto("/reports/" + fixture.reportId);
  await expect(page.getByRole("heading", { name: "Strengths by lens" })).toBeVisible();
  await expect(page.getByText(/Gross Margin Comfortably Above Healthy Range/i).first()).toBeVisible();
  await expect(page.getByText(/3 strengths? · 0 to address|1 strength · 0 to address/i).first()).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "21-healthy-strengths-by-lens");

  await page.goto("/dashboard");
  await expect(page.getByText(/Here's what's holding/i)).toBeVisible();
  await step(page, testInfo, "11-combinatorial", "22-healthy-dashboard");
});
