import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedClientWithSentReport, seedClientWithUndeliveredReport } from "./support/seed";
import { step } from "./support/screenshot";

/**
 * Flow 12: re-audit payment gate — confirmed 2026-09-06.
 *
 * Covers the two things real browser interaction can prove directly:
 * Part 2's popup (shown every time before this cycle's form becomes
 * accessible, Cancel navigates away, Continue reveals the form regardless
 * of payment status) and Rule 1 (a client cannot start a new submission
 * while a prior report is still undelivered).
 *
 * Deliberately NOT covering Rule 2's full payment-hold → admin-notify →
 * mark-paid → audit-auto-runs chain here — that spans a cron tick and a
 * real Groq-backed audit run, verified instead via direct calls to the
 * real functions involved (same established pattern this codebase already
 * uses for every other cron/notification-dependent flow), not a UI-only
 * substitute.
 */
test("Re-audit payment gate popup: shown every visit, Cancel navigates away, Continue reveals the form", async ({ page }, testInfo) => {
  const fixture = await seedClientWithSentReport();
  await loginAsTestUser(page, fixture.clientEmail);

  await page.goto("/evidence-intake");
  await expect(page.getByRole("heading", { name: "This is a paid re-audit" })).toBeVisible();
  await expect(page.getByText(/£149/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to Payment" })).toBeVisible();
  // The form itself must NOT be accessible yet.
  await expect(page.getByRole("heading", { name: "Submit your evidence" })).not.toBeVisible();
  await step(page, testInfo, "12-reaudit-gate", "01-gate-shown");

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await step(page, testInfo, "12-reaudit-gate", "02-cancel-navigates-away");

  // No persisted "seen it" flag (confirmed decision) — revisiting shows the gate again.
  await page.goto("/evidence-intake");
  await expect(page.getByRole("heading", { name: "This is a paid re-audit" })).toBeVisible();
  await step(page, testInfo, "12-reaudit-gate", "03-gate-shown-again-on-revisit");

  // "Continue to Payment" opens the real link in a new tab (target="_blank")
  // AND reveals the form in this same tab immediately — acknowledgment
  // only, never a verified-payment check (confirmed decision).
  const continueLink = page.getByRole("link", { name: "Continue to Payment" });
  await expect(continueLink).toHaveAttribute("target", "_blank");
  await continueLink.click();
  await expect(page.getByRole("heading", { name: "Submit your evidence" })).toBeVisible();
  await step(page, testInfo, "12-reaudit-gate", "04-continue-reveals-form");
});

test("Rule 1: a client with an undelivered prior report cannot start a new submission", async ({ page }, testInfo) => {
  const fixture = await seedClientWithUndeliveredReport();
  await loginAsTestUser(page, fixture.clientEmail);

  await page.goto("/evidence-intake");
  await expect(page.getByRole("heading", { name: "Your previous audit is still being reviewed" })).toBeVisible();
  await expect(page.getByText(/only one audit cycle can be active at a time/i)).toBeVisible();
  // Neither the gate popup nor the real form should ever be reachable here.
  await expect(page.getByRole("heading", { name: "This is a paid re-audit" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Submit your evidence" })).not.toBeVisible();
  await step(page, testInfo, "12-reaudit-gate", "05-rule1-blocked");
});
