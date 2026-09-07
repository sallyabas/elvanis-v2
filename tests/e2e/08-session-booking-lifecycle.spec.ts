import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser, fillSessionRequestContactFields } from "./support/auth";
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
 * "Request Concierge — £{price}" button, real DB-backed pricing unified
 * with the landing page's own price 2026-09-05 — same SessionRequestButton
 * wrapper used on evidence-intake/the report page, just with a real
 * priceLabel passed in).
 *
 * Concierge's REVIEWER-side flow updated 2026-09-07 (Contact Sales status
 * flow, final spec) — no longer walked through /queue's generic
 * Schedule/Complete/Decline panel, which now deliberately excludes
 * Concierge/Training & Advisory entirely (session_requests.status is
 * permanently frozen at 'requested' for these two types going forward;
 * service_status_records is the one true, authoritative status source
 * instead). Walked through the real ContactSalesStatusRow on
 * /company/[companyId] instead: Requested -> Booked (plain Update) ->
 * Completed (note field unlocks only once Completed is selected, Option
 * A UX, then "Add note" persists status+note together in one action).
 *
 * Client-side rendering is checked against the real, confirmed split:
 * Discovery never appears on Dashboard (any state) and always appears on
 * Reports & History (any state); Delivery appears on Dashboard only while
 * requested/scheduled and moves to Reports & History once terminal
 * (completed/declined); Concierge appears on Dashboard only while
 * requested/booked (service_status_records-driven) and moves to Reports &
 * History once terminal (completed/canceled/refunded).
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

  // Mandatory contact fields (confirmed 2026-09-05) — Email pre-fills
  // correctly from the real signed-in test user; Name/Phone don't (this
  // fixture never seeds `users.name`/`phone`), so each widget's fields
  // are filled before its own request button is clicked, same as a real
  // first-time client would.
  await page.goto("/evidence-intake");
  // Re-audit payment gate (confirmed 2026-09-06) — this fixture's company
  // already has a real `sent` report (seeded so Delivery Session's own
  // precondition is satisfied, see seedSessionLifecycleFixtures()'s own
  // docblock), so isFreeAudit is genuinely false here — the payment gate
  // correctly shows before the Discovery Session widget becomes
  // reachable, exactly as designed. "Continue to Payment" reveals the
  // form regardless of payment status (confirmed decision).
  await page.getByRole("link", { name: "Continue to Payment" }).click();
  const discoveryRequestButton = page.getByRole("button", { name: "Request a Discovery Session" });
  await fillSessionRequestContactFields(discoveryRequestButton);
  await discoveryRequestButton.click();
  await expect(page.getByText("Discovery Session requested")).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "01-discovery-requested");

  await page.goto(`/reports/${fixtures.sentReportId}`);
  const deliveryRequestButton = page.getByRole("button", { name: "Request a Delivery Session" });
  await fillSessionRequestContactFields(deliveryRequestButton);
  await deliveryRequestButton.click();
  await expect(page.getByText("Delivery Session requested")).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "02-delivery-requested");

  await page.goto("/services");
  const conciergeRequestButton = page.getByRole("button", { name: /Request Concierge/i });
  await fillSessionRequestContactFields(conciergeRequestButton);
  await conciergeRequestButton.click();
  await expect(page.getByText("Concierge inquiry sent")).toBeVisible();
  await step(page, testInfo, "08-session-lifecycle", "03-concierge-requested");

  // --- Reviewer half: all three land in the pending panel ---
  await loginAsTestUser(page, fixtures.reviewerEmail);
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Session requests" })).toBeVisible();

  const discoveryItem = sessionItem(page, fixtures.companyName, "Discovery Session");
  const deliveryItem = sessionItem(page, fixtures.companyName, "Delivery Session");

  await expect(discoveryItem.getByText("Requested — awaiting scheduling")).toBeVisible();
  await expect(deliveryItem.getByText("Requested — awaiting scheduling")).toBeVisible();
  // Concierge deliberately absent from this panel (confirmed 2026-09-07,
  // Contact Sales flow) — its real status lives on /company/[companyId]
  // instead, verified in its own block below.
  await expect(page.getByText("Concierge Inquiry")).not.toBeVisible();
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

  // Concierge: real Contact Sales flow (confirmed 2026-09-07), driven via
  // ContactSalesStatusRow on /company/[companyId], not /queue.
  await page.goto(`/company/${fixtures.companyId}`);
  const conciergeRow = page.locator("li", { hasText: "Concierge Inquiry" });
  const conciergeStatusSelect = conciergeRow.locator("select").first();
  await expect(conciergeStatusSelect).toHaveValue("requested");

  // Requested -> Booked, plain status update (no note involved yet).
  // Checked via the select's own persisted value, not getByText("Booked")
  // — that ambiguously also matches the dropdown's own <option> text,
  // which Playwright correctly reports as "hidden" while the select is
  // closed (a real test-authoring correction, not an app bug).
  await conciergeStatusSelect.selectOption("booked");
  await conciergeRow.getByRole("button", { name: "Update" }).click();
  // Locators re-resolve against the current page on every action (not a
  // stale captured DOM handle) — reload forces the fresh, revalidated
  // server-rendered value through, then the SAME locator recipe confirms
  // it persisted.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(conciergeStatusSelect).toHaveValue("booked", { timeout: 10_000 });
  await step(page, testInfo, "08-session-lifecycle", "07a-concierge-booked");

  // Note field UX Option A (confirmed 2026-09-07, item 5) — disabled/
  // guiding-placeholder until 'Completed' is selected; only then does it
  // (and the "Add note" button) become usable, and one submit persists
  // status + note together.
  const conciergeNoteField = conciergeRow.getByPlaceholder("Change status to Completed to add a note");
  await expect(conciergeNoteField).toBeDisabled();
  await conciergeStatusSelect.selectOption("completed");
  const conciergeActiveNoteField = conciergeRow.getByPlaceholder("Add a note (also logs a Reviewer Notes entry)");
  await expect(conciergeActiveNoteField).toBeEnabled();
  await conciergeActiveNoteField.fill("Scoped Concierge terms, sending a proposal.");
  await conciergeRow.getByRole("button", { name: "Add note" }).click();
  // The note text itself is unambiguous real content (unlike "Completed",
  // which also matches the dropdown's own <option> text) — real proof the
  // note-add succeeded and locked.
  await expect(conciergeRow.getByText(/Scoped Concierge terms, sending a proposal/i)).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(conciergeStatusSelect).toHaveValue("completed");
  await step(page, testInfo, "08-session-lifecycle", "07b-concierge-completed-via-company-page");

  // Back to /queue for the remaining Delivery decline step — the
  // Concierge block above navigated away to /company/[companyId].
  await page.goto("/queue");

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
