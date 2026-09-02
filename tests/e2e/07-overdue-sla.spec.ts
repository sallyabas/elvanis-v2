import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedSlaFixtures } from "./support/sla";
import { step } from "./support/screenshot";

/**
 * Flow 7: Overdue badge / SLA — confirmed 2026-09-03.
 *
 * Written against the CORRECTED behavior confirmed the same day (see
 * CLAUDE.md's "Fix case_library duplicate-key bug, all-lens-failure gap,
 * and SLA drift"), not the pre-fix inconsistency: the queue's module
 * Overdue badge and Dashboard's client-facing overdue copy both now read
 * `module_delivery_turnaround_target_hours` from app_settings — the same
 * setting the landing page and module review workspace always used, not
 * the core-audit-specific getTotalTurnaroundHours() they used to read.
 *
 * The real configured value is read directly from app_settings in
 * support/sla.ts (never assumed as a fixed number), and used to compute a
 * fixture genuinely past the real deadline regardless of what that value
 * currently is — a hardcoded "48h ago" would silently stop testing
 * anything meaningful the day someone changes the setting.
 *
 * Covers three surfaces the same fix touched: the reviewer queue's badge
 * (for both a Core Audit report AND a module still in pending_review —
 * the pending-module case is itself a real, newly-added behavior, not
 * previously possible at all), the core-audit client holding page's
 * overdue-aware copy, and Dashboard's client-facing overdue-module copy.
 * A non-overdue control item for both report and module types confirms
 * the badge isn't just permanently on.
 */
test("Overdue badge fires correctly on the reviewer queue and client-facing copy stays accurate", async ({ page }, testInfo) => {
  const fixtures = await seedSlaFixtures();

  // --- Reviewer side: the queue's Overdue badges ---
  await loginAsTestUser(page, fixtures.reviewerEmail);
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Reviewer Queue" })).toBeVisible();

  // Scoped to each company's own group (an <h3> followed by its own <ul>,
  // both inside one shared wrapper div — see queue/page.tsx) rather than a
  // page-wide text search, since real pre-existing overdue items from
  // other companies are expected to be present in this same queue.
  const overdueGroup = page.locator("h3", { hasText: fixtures.overdueCompanyName }).locator("xpath=..");
  const controlGroup = page.locator("h3", { hasText: fixtures.controlCompanyName }).locator("xpath=..");

  await expect(overdueGroup).toBeVisible();
  await expect(controlGroup).toBeVisible();

  // The overdue company has 2 items (a Core Audit report + a module
  // request), both genuinely past their real deadline — both should carry
  // the badge. Checked per-listitem, not via a blanket
  // getByText(/overdue/i).toHaveCount() on the whole group — a real,
  // confirmed Playwright gotcha found live: getByText's substring match
  // can resolve to more elements than there are visually distinct badges
  // when the badge's own text is nested inside other elements whose
  // aggregated text also contains the match, so a flat count across the
  // whole group is not a reliable signal of "how many items are overdue."
  const overdueGroupItems = overdueGroup.getByRole("listitem");
  await expect(overdueGroupItems).toHaveCount(2);
  const overdueItemCount = await overdueGroupItems.count();
  for (let i = 0; i < overdueItemCount; i++) {
    await expect(overdueGroupItems.nth(i).getByText(/overdue/i).first()).toBeVisible();
  }
  await step(page, testInfo, "07-overdue-sla", "01-queue-overdue-company");

  // The control company also has 2 items, neither past its deadline —
  // proving the badge is a real, correctly-computed signal, not always on.
  await expect(controlGroup.getByRole("listitem")).toHaveCount(2);
  await expect(controlGroup.getByText(/overdue/i)).toHaveCount(0);
  await step(page, testInfo, "07-overdue-sla", "02-queue-control-company");

  // --- Client side: the core-audit holding page's overdue-aware copy ---
  await loginAsTestUser(page, fixtures.clientEmail);
  await page.goto(`/reports/${fixtures.overdueReportId}`);
  await expect(page.getByRole("heading", { name: "Your report is being reviewed" })).toBeVisible();
  // The corrected copy (confirmed 2026-09-03) — previously this page
  // always said "ready within N hours" regardless of whether that had
  // already passed, which is exactly the misleading state this fix
  // closes.
  await expect(page.getByText(/taking a little longer than expected to reach you/i)).toBeVisible();
  // The old, now-incorrect-for-this-case copy must NOT appear alongside it.
  await expect(page.getByText(/ready within \d+ hours of your original submission/i)).not.toBeVisible();
  await step(page, testInfo, "07-overdue-sla", "03-holding-page-overdue-copy");

  // --- Client side: Dashboard's overdue-module copy (pending_review stage) ---
  await page.goto("/dashboard");
  await expect(page.getByText(/has been with your reviewer since.*taking a little longer than expected/i)).toBeVisible();
  await step(page, testInfo, "07-overdue-sla", "04-dashboard-overdue-module-copy");
});
