import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedReviewableReport } from "./support/seed";
import { createTestAdminClient } from "./support/db";
import { step } from "./support/screenshot";

/**
 * Flow 10: reviewer report-level "second opinion" on Top 3 (confirmed
 * 2026-09-04) — a real, separate feature from spec 9's per-finding
 * version, not a replacement for it. Same "no real Anthropic call" design
 * as spec 9 — see playwright.config.ts's own webServer.env docblock.
 * Reuses seedReviewableReport(), which already sets a real
 * `top_3_finding_ids` (financial + execution + ai_governance findings),
 * exactly what this feature needs to check against.
 */
test('"Get a second opinion on Top 3": placement, loading, error handling, double-click protection', async ({ page }, testInfo) => {
  const fixture = await seedReviewableReport();

  await loginAsTestUser(page, fixture.reviewerEmail);
  await page.goto(`/review/${fixture.reportId}`);
  await expect(page.getByRole("heading", { name: fixture.companyName })).toBeVisible();

  // --- Placement: exactly one button, inside the "Top 3 priorities" section, not per-finding ---
  const top3Section = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Top 3 priorities" }) }).first();
  const reportButton = top3Section.getByRole("button", { name: "Get a second opinion on Top 3" });
  await expect(reportButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Get a second opinion on Top 3" })).toHaveCount(1);
  await step(page, testInfo, "10-second-opinion-report", "01-button-in-top3-section");

  // --- Double-click protection — see spec 9's own docblock for the full ---
  // --- reasoning: two genuinely synchronous click events dispatched ---
  // --- directly in the browser, testing handleRequest()'s own explicit ---
  // --- reentrancy guard (added 2026-09-04), not a timing-dependent poll ---
  // --- of the `disabled` attribute. ---
  let postCount = 0;
  page.on("request", (req) => {
    if (req.method() === "POST") postCount++;
  });
  const buttonHandle = await reportButton.elementHandle();
  await buttonHandle!.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });

  await expect(top3Section.getByText(/Something went wrong reaching the server/i)).toBeVisible({ timeout: 10_000 });
  await expect(top3Section.getByText(/Something went wrong reaching the server/i)).toHaveCount(1);
  await expect(reportButton).toBeEnabled();
  await step(page, testInfo, "10-second-opinion-report", "02-error-shown-button-reenabled");

  expect(postCount).toBe(1);

  // --- Zero partial writes on failure ---
  const supabase = createTestAdminClient();
  const { data: opinions, error } = await supabase.from("report_second_opinions").select("id").eq("report_id", fixture.reportId);
  expect(error).toBeNull();
  expect(opinions).toHaveLength(0);
});
