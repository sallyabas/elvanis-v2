import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { freshTestEmail } from "./support/testEmail";
import { step } from "./support/screenshot";

/**
 * Flow 4: Hub path ("I'm not sure yet") — confirmed 2026-09-02.
 *
 * Real sequence, per OnboardingFlow.tsx: entry screen -> "I'm not sure
 * yet" -> a real minimal-name bridge step (the one unavoidable field,
 * `companies.name` is not null) -> Hub screen (both real options shown,
 * no data collection of its own) -> picking "Business Diagnosis" attaches
 * the goal-selection wizard onto that same company (mode="attach",
 * company step skipped) through to Evidence Intake.
 */
test("Hub path: not sure -> minimal name -> Hub -> attach onto Business Diagnosis", async ({ page }, testInfo) => {
  const email = freshTestEmail("hub");
  await loginAsTestUser(page, email);

  await page.goto("/business-profile");
  await expect(page.getByRole("heading", { name: "What brings you here today?" })).toBeVisible();
  await page.getByRole("button", { name: "I'm not sure yet" }).click();

  await expect(page.getByRole("heading", { name: "What's your company called?" })).toBeVisible();
  await step(page, testInfo, "04-hub-path", "01-minimal-name");
  await page.getByLabel("Company name").fill("Playwright Hub Co");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Which fits you better?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business Diagnosis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Compliance Audit" })).toBeVisible();
  await step(page, testInfo, "04-hub-path", "02-hub-screen");

  // Two buttons share the label "Start with this one" — the original
  // div-filter scoping attempt here genuinely failed live (a plain
  // `locator("div", {hasText: ...})` matches every ANCESTOR div containing
  // that text too, not just the immediate card, so the filter still
  // resolved to both buttons). Simpler and just as robust: HubScreen.tsx's
  // own source has "Business Diagnosis" hardcoded as the first of the two
  // fixed cards, so .first() deterministically picks its button.
  await page.getByRole("button", { name: "Start with this one" }).first().click();

  // Attach mode, company NAME already known (from the minimal-name bridge
  // step) but skipCompanyDetails is NOT set for this specific path (unlike
  // PathBWizard's own core_audit fork, which does skip it) — confirmed by
  // reading OnboardingWizard.tsx directly rather than assumed: Step 1 here
  // is still "Company", showing "Continuing for <name>" plus real
  // Industry/Employee count fields.
  await expect(page.getByText("Step 1 of 5: Company")).toBeVisible();
  await expect(page.getByText(/Continuing for Playwright Hub Co/i)).toBeVisible();
  await step(page, testInfo, "04-hub-path", "03-attach-wizard-company");
  await page.getByLabel("Industry").fill("B2B SaaS");
  await page.getByLabel("Employee count").fill("12");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Step 2 of 5: Goal")).toBeVisible();
  await step(page, testInfo, "04-hub-path", "04-attach-wizard-goal");
});
