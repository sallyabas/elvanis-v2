import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedReviewableReport } from "./support/seed";
import { createTestAdminClient } from "./support/db";
import { step } from "./support/screenshot";

/**
 * Flow 9: reviewer per-finding "second opinion" (Financial lens v1,
 * confirmed 2026-09-04) — real Playwright coverage for everything that
 * doesn't require a real, live Claude API call: button placement/scope,
 * loading state, error handling, double-click protection, and confirming
 * zero partial writes on failure. Reuses seedReviewableReport() (spec 6's
 * own fixture) rather than a new one — it already has exactly one real
 * Financial-lens finding plus three non-Financial findings, which is
 * exactly the placement/scope test this spec needs.
 *
 * Deliberately does NOT make a real Anthropic call — see
 * playwright.config.ts's own webServer.env docblock: ANTHROPIC_API_KEY is
 * explicitly overridden to empty for this suite by default, so clicking
 * the button here reliably and safely exercises the real, deterministic
 * "key not set" error path, at zero cost, regardless of what real key is
 * sitting in .env.local for manual use. Real, paid-call corner-case tests
 * (actual classification accuracy, duplicate detection, the
 * healthy_finding_in_top3 edge case, token cost) are a deliberate, later,
 * separately-approved step (E2E_ALLOW_PAID_AI_CALLS=true) — not this spec.
 *
 * No cleanup needed beyond the standard test-account cleanup: since every
 * attempt here is designed to fail before any DB write, this spec never
 * creates a real finding_second_opinions row to clean up.
 */
test("Get a second opinion (Financial only): placement, loading, error handling, double-click protection", async ({ page }, testInfo) => {
  const fixture = await seedReviewableReport();

  await loginAsTestUser(page, fixture.reviewerEmail);
  await page.goto(`/review/${fixture.reportId}`);
  await expect(page.getByRole("heading", { name: fixture.companyName })).toBeVisible();

  // --- Placement/scope: exactly one button, only next to the Financial finding ---
  // exact: true — "Get a second opinion" is otherwise a substring match of
  // the separate report-level "Get a second opinion on Top 3" button
  // (spec 10), which would double-count here.
  const secondOpinionButtons = page.getByRole("button", { name: "Get a second opinion", exact: true });
  await expect(secondOpinionButtons).toHaveCount(1);

  const financialFinding = page.locator("li", { hasText: "Critical Customer Revenue Concentration" });
  const button = financialFinding.getByRole("button", { name: "Get a second opinion", exact: true });
  await expect(button).toBeVisible();

  // Confirmed absent for every non-Financial-lens finding — v1 scope is
  // Financial only, enforced server-side, but the button shouldn't even
  // render as an option for the other three seeded findings.
  for (const title of ["PR Review Pickup Time Above Benchmark", "Core Feature Adoption Below Healthy Range", "No AI Literacy Training for Staff Using AI Tools"]) {
    const otherFinding = page.locator("li", { hasText: title });
    await expect(otherFinding.getByRole("button", { name: "Get a second opinion", exact: true })).toHaveCount(0);
  }
  await step(page, testInfo, "09-second-opinion-finding", "01-button-scoped-to-financial-only");

  // --- Double-click protection: two genuinely synchronous click events, ---
  // --- back to back in the same JS tick, dispatched directly in the ---
  // --- browser — faster than React can possibly commit the `disabled` ---
  // --- attribute between them, the real worst case a plain toBeDisabled() ---
  // --- poll (tried first, found to be racy against how fast the request ---
  // --- genuinely settles here) can't reliably exercise. The real
  // protection is handleRequest()'s own explicit `if (status ===
  // "loading") return;` guard (added 2026-09-04, found necessary by this
  // exact test), not the disabled attribute alone.
  let postCount = 0;
  page.on("request", (req) => {
    if (req.method() === "POST") postCount++;
  });
  const buttonHandle = await button.elementHandle();
  await buttonHandle!.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });

  await expect(financialFinding.getByText(/Something went wrong reaching the server/i)).toBeVisible({ timeout: 10_000 });
  // Exactly one error alert — not two, confirming no duplicate/raced
  // render occurred despite the two dispatched click events.
  await expect(financialFinding.getByText(/Something went wrong reaching the server/i)).toHaveCount(1);
  await expect(button).toBeEnabled();
  await step(page, testInfo, "09-second-opinion-finding", "02-error-shown-button-reenabled");

  // The real double-click-protection proof: exactly one POST fired
  // despite two genuinely synchronous click events.
  expect(postCount).toBe(1);

  // --- Zero partial writes on failure ---
  const supabase = createTestAdminClient();
  const { data: opinions, error } = await supabase.from("finding_second_opinions").select("id").eq("finding_id", fixture.findingIds.critical);
  expect(error).toBeNull();
  expect(opinions).toHaveLength(0);
});
