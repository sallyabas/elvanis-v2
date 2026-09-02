import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { freshTestEmail } from "./support/testEmail";
import { getCompanyIdByName, setCompanyTriage } from "./support/pathB";
import { step } from "./support/screenshot";

/**
 * Flow 3: Path B signup through all four triage branches to dashboard —
 * confirmed 2026-09-02.
 *
 * Design, disclosed rather than assumed: branch 1 goes through the real
 * 5-field profile + real triage-question UI clicks once, proving the
 * actual radio-click path and the profile form both work end-to-end.
 * Branches 2-4 reuse the SAME company and directly set its
 * `triage_ai_usage`/`triage_compliance_request`/`triage_personal_data`
 * columns (see support/pathB.ts), then reload `/ai-audit` — which (per
 * that page's own code) recomputes and renders the recommendation
 * directly from those columns regardless of how they were set. This
 * exercises the real deterministic routing computation for all 4
 * combinations against the real rendering code, without needing 3 more
 * full signups + repeated real-UI radio clicks per branch.
 *
 * Each branch's real recommendation copy is asserted, then the spec
 * confirms the ai_audit-path Dashboard lead section renders correctly —
 * satisfying "to dashboard" without forcing every branch through its own
 * separate downstream flow (module intake, consultation booking), which
 * is out of this spec's scope.
 */
test("Path B: signup through all four triage branches to dashboard", async ({ page }, testInfo) => {
  const email = freshTestEmail("path-b");
  const companyName = `Playwright Path B Co ${Date.now()}`;
  await loginAsTestUser(page, email);

  await page.goto("/business-profile");
  await expect(page.getByRole("heading", { name: "What brings you here today?" })).toBeVisible();
  await page.getByRole("button", { name: "Get an AI compliance audit" }).click();

  // 5-field minimal profile
  await expect(page.getByRole("heading", { name: "Tell us about your business" })).toBeVisible();
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Your name").fill("PW Test Runner");
  await page.getByLabel("Industry").fill("B2B SaaS");
  await page.getByLabel("Employee count").fill("30");
  await page.getByLabel("Registration country").selectOption({ label: "United Kingdom" });
  const marketInput = page.getByPlaceholder(/United Kingdom, Germany, Saudi Arabia/i);
  await marketInput.fill("France");
  await marketInput.press("Enter");
  await step(page, testInfo, "03-path-b", "01-profile");
  await page.getByRole("button", { name: "Continue" }).click();

  // Branch 1 (real UI): customer-facing AI + active request + yes personal data
  // -> Tender Readiness, URGENT + Data Protection Compliance additional
  await expect(page.getByText("A couple of quick questions")).toBeVisible();
  await page.getByText("Yes — customers interact with it directly").click();
  await page.getByText("Yes — I have an active request to respond to").click();
  await page.getByText("Yes", { exact: true }).click();
  await step(page, testInfo, "03-path-b", "02-triage-branch-1");
  await page.getByRole("button", { name: "Continue" }).click();

  // .first() throughout this spec's recommendation assertions — confirmed
  // live, not assumed: each recommendation's own body copy also mentions
  // its title in prose (e.g. "...Tender Readiness gets you a real
  // jurisdiction determination..."), so a plain text match is genuinely
  // ambiguous between the title element and its own description.
  await expect(page.getByText("Here's what we'd recommend")).toBeVisible();
  await expect(page.getByText("Tender Readiness").first()).toBeVisible();
  await expect(page.getByText("URGENT").first()).toBeVisible();
  await expect(page.getByText("Data Protection Compliance").first()).toBeVisible();
  await step(page, testInfo, "03-path-b", "03-recommendation-branch-1");

  const companyId = await getCompanyIdByName(companyName);

  // Branch 2: internal-only AI + want-ahead + not-sure personal data
  // -> AI Reliability Audit (not urgent) + Data Protection Compliance
  await setCompanyTriage(companyId, "internal_only", "want_ahead", "not_sure");
  await page.goto("/ai-audit");
  await expect(page.getByText("Here's what we'd recommend")).toBeVisible();
  await expect(page.getByText("AI Reliability Audit").first()).toBeVisible();
  await expect(page.getByText("Data Protection Compliance").first()).toBeVisible();
  await step(page, testInfo, "03-path-b", "04-recommendation-branch-2");

  // Branch 3: exploring AI + active request + no personal data
  // -> human consultation, URGENT, no additional module
  await setCompanyTriage(companyId, "exploring", "active_request", "no");
  await page.goto("/ai-audit");
  await expect(page.getByText("A conversation with your reviewer")).toBeVisible();
  await expect(page.getByText("URGENT").first()).toBeVisible();
  await step(page, testInfo, "03-path-b", "05-recommendation-branch-3");

  // Branch 4: not-sure AI + not-applicable + no personal data
  // -> core_audit fork ("A full business diagnosis")
  await setCompanyTriage(companyId, "not_sure", "not_applicable", "no");
  await page.goto("/ai-audit");
  // .first() — same reason as every other recommendation assertion in this
  // spec: the body copy below the title also mentions "a full business
  // diagnosis" in its own sentence, confirmed live via a real strict-mode
  // violation.
  await expect(page.getByText("A full business diagnosis").first()).toBeVisible();
  await step(page, testInfo, "03-path-b", "06-recommendation-branch-4");

  await page.goto("/dashboard");
  await expect(page.getByText(/AI AUDIT STATUS|Finish setting up your AI Audit/i).first()).toBeVisible();
  await step(page, testInfo, "03-path-b", "07-dashboard");
});
