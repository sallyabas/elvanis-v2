import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedSessionLifecycleFixtures } from "./support/sessionLifecycle";
import { step } from "./support/screenshot";

/**
 * Flow 8: session booking lifecycle — confirmed 2026-09-03.
 *
 * Covers Discovery / Delivery / Concierge inquiry, per explicit design:
 * the INTENDED single lifecycle only, not the known duplicate-request gap
 * (SessionRequestButton doesn't check for an existing active request
 * before offering itself again) — that's tracked as its own separate bug,
 * deliberately not asserted here as expected behavior either way.
 *
 * Both real transition paths get real coverage, spread across the three
 * types rather than repeating one path three times: Discovery goes
 * requested -> scheduled -> completed (the full 3-stage path, plus real
 * date/time and outcome-notes fields); Delivery goes requested ->
 * declined (also exercises requestSession()'s own real precondition — a
 * Delivery Session can only be requested once a report is genuinely
 * delivered, seeded directly via a real `sent` report row); Concierge
 * inquiry is requested via its own distinct entry point (Services page's
 * "Contact Sales," not the SessionRequestButton wrapper used on
 * evidence-intake/the report page) and also walked through schedule ->
 * complete, since the mechanism is now proven and the marginal cost of
 * covering the third type is low.
 *
 * Client-side rendering is checked against the real, confirmed split:
 * Discovery never appears on Dashboard (any state) and always appears on
 * Reports & History (any state); Delivery/Concierge appear on Dashboard
 * only while requested/scheduled and move to Reports & History once
 * terminal (completed/declined).
 */
function sessionItem(page: Page, companyName: string, sessionTypeLabel: string) {
  return page.locator("li", { hasText: companyName }).filter({ hasText: sessionTypeLabel });
}

test("Session requests: Discovery (schedule->complete), Delivery (decline), Concierge (schedule->complete)", async ({ page }, testInfo) => {
  // This spec does meaningfully more real sequential work than most others
  // in this suite — 3 real requests, 3 full reviewer actions (with real
  // settle waits), and 3 page loads for final-state verification — real
  // headroom above the default 30s, not padding for its own sake.
  test.setTimeout(60_000);

  const fixtures = await seedSessionLifecycleFixtures();

  // --- Client half: request all three, via their real distinct entry points ---
  await loginAsTestUser(page, fixtures.clientEmail);

  await page.goto("/evidence-intake");
  await page.getByRole("button", { name: "Request a Discovery Session" }).click();
  await expect(page.getByText("Discovery Session requested")).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "01-discovery-requested");

  await page.goto(`/reports/${fixtures.sentReportId}`);
  await page.getByRole("button", { name: "Request a Delivery Session" }).click();
  await expect(page.getByText("Delivery Session requested")).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "02-delivery-requested");

  await page.goto("/services");
  await page.getByRole("button", { name: "Contact Sales" }).click();
  await expect(page.getByText("Concierge inquiry sent")).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "03-concierge-requested");

  // --- Reviewer half: all three land in the pending panel ---
  await loginAsTestUser(page, fixtures.reviewerEmail);
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Session requests" })).toBeVisible();

  const discoveryItem = sessionItem(page, fixtures.companyName, "Discovery Session");
  const deliveryItem = sessionItem(page, fixtures.companyName, "Delivery Session");
  const conciergeItem = sessionItem(page, fixtures.companyName, "Concierge Inquiry");

  await expect(discoveryItem.getByText("Requested — awaiting scheduling")).toBeVisible();
  await expect(deliveryItem.getByText("Requested — awaiting scheduling")).toBeVisible();
  await expect(conciergeItem.getByText("Requested — awaiting scheduling")).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "04-queue-all-requested");

  // Discovery: schedule with a real future date/time + notes.
  await discoveryItem.getByLabel("Schedule for").fill("2027-01-15T14:30");
  await discoveryItem.getByPlaceholder("Notes (optional)").fill("Intro call to walk through their stack.");
  await discoveryItem.getByRole("button", { name: "Schedule" }).click();
  // .first() — "Scheduled" matches both the short status label
  // ("Scheduled · requested...") and the longer confirmation paragraph
  // ("Scheduled for 1/15/2027..."), confirmed live via a real strict-mode
  // violation; either occurrence is equally valid proof the state changed.
  await expect(discoveryItem.getByText("Scheduled").first()).toBeVisible({ timeout: 10_000 });
  await expect(discoveryItem.getByText(/Intro call to walk through their stack/i)).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "05-discovery-scheduled");

  // Real timing issue found live, not assumed: the Schedule Server
  // Action's own revalidatePath() can still be settling a moment after
  // "Scheduled" text first becomes visible, and an immediate fill+click
  // on the Complete form right after occasionally landed on a DOM node
  // about to be replaced by that in-flight re-render — confirmed NOT an
  // app bug by reproducing the identical click via a raw DOM dispatch
  // outside Playwright, which worked correctly every time. A short,
  // explicit settle window here is the fix, not a workaround for
  // something actually broken.
  await page.waitForTimeout(500);

  // Discovery: complete with real outcome notes.
  await discoveryItem.getByPlaceholder("Outcome notes").fill("Covered onboarding blockers, agreed next steps by email.");
  await discoveryItem.getByRole("button", { name: "Mark completed" }).click();
  // Terminal — drops out of this pending panel entirely (listPendingSessionRequests only returns requested/scheduled).
  await expect(discoveryItem).not.toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "08-session-lifecycle", "06-discovery-completed-dropped-from-queue");

  // Concierge: same schedule -> complete path, proving the mechanism generically, not just for Discovery.
  await conciergeItem.getByLabel("Schedule for").fill("2027-01-20T10:00");
  await conciergeItem.getByRole("button", { name: "Schedule" }).click();
  await expect(conciergeItem.getByText("Scheduled").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await conciergeItem.getByPlaceholder("Outcome notes").fill("Scoped Concierge terms, sending a proposal.");
  await conciergeItem.getByRole("button", { name: "Mark completed" }).click();
  await expect(conciergeItem).not.toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "08-session-lifecycle", "07-concierge-completed-dropped-from-queue");

  // Delivery: decline with a real, required reason.
  await deliveryItem.getByPlaceholder("Reason (required)").fill("Client's report was just delivered same-day — following up in 2 weeks once they've had time to review.");
  await deliveryItem.getByRole("button", { name: "Decline" }).click();
  await expect(deliveryItem).not.toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "08-session-lifecycle", "08-delivery-declined-dropped-from-queue");

  // --- Client half: verify each final state on the correct real surface ---
  await loginAsTestUser(page, fixtures.clientEmail);

  // Dashboard: Discovery never shown (any state); Delivery/Concierge are
  // both terminal now, so neither should show here either — Dashboard's
  // active-session panel should have nothing left from this fixture.
  await page.goto("/dashboard");
  await expect(page.getByText("Discovery Session")).not.toBeVisible();
  await expect(page.getByText("Delivery Session")).not.toBeVisible();
  await expect(page.getByText("Concierge Inquiry")).not.toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "09-dashboard-no-active-sessions-left");

  // Reports & History: all three now visible, in their real final states
  // with their real reviewer-authored notes.
  await page.goto("/reports");
  await expect(page.getByText("Discovery Session")).toBeVisible();
  await expect(page.getByText(/Covered onboarding blockers, agreed next steps by email/i)).toBeVisible();
  await expect(page.getByText("Concierge Inquiry")).toBeVisible();
  await expect(page.getByText(/Scoped Concierge terms, sending a proposal/i)).toBeVisible();
  await expect(page.getByText("Delivery Session")).toBeVisible();
  await expect(page.getByText(/following up in 2 weeks once they've had time to review/i)).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "10-reports-history-final-states");
});
