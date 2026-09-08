import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedReviewableReport } from "./support/seed";
import { step } from "./support/screenshot";

/**
 * Reviewer Home page (confirmed 2026-09-08, final status-flow spec, item
 * 7) — real coverage for every real widget: regulatory framework status
 * (moved here from the sidebar), the Requests widget (a real 7-bucket x
 * 8-service-type breakdown backed by computeRequestBuckets() — see that
 * function's own dedicated, already-passing unit-test suite,
 * requests-summary.test-cases.ts, for the pure-logic proof this spec
 * deliberately doesn't re-litigate), the Clients widget (total +
 * "recently active"), the recent-activity feed, and the idea-backlog
 * count. `/queue` itself, confirmed unaffected by any of this, gets its
 * own direct re-check too — removing the regulatory widget from the
 * sidebar is the one change that touches every reviewer page at once.
 *
 * Before/after deltas, not absolute values — this app's own Supabase
 * project accumulates real historical proof data across this whole
 * session's own history (kept, real companies/reports, per this
 * codebase's own standing retention precedent), so asserting an exact
 * absolute count anywhere on this shared, cumulative page would be
 * fragile by construction. Same "read the real baseline, act, confirm
 * the real delta" discipline already used throughout this session's own
 * live-verification passes.
 *
 * Every widget scoped via its own Card <section> (located by its real
 * <h2> title, per Card.tsx's own markup) rather than page-wide text/regex
 * locators — the page genuinely has multiple bare-digit numbers on it at
 * once (Clients' total, Ideas' counts, every Requests-table cell), so an
 * unscoped locator would be a real, live ambiguity risk, not a
 * hypothetical one.
 *
 * Deliberately NOT testing the real magic-link/code post-login redirect
 * to /home end-to-end — this suite's own established pattern
 * (loginAsTestUser(), see support/auth.ts's own docblock) exists
 * specifically to avoid needing a real magic-link/OTP round trip, and a
 * Server Action's internal signInWithOtp() call has no client-observable
 * network payload a browser-side test could inspect either way — there
 * is no lightweight way to prove this from inside the browser. The
 * actual redirect-target change (next=/home in reviewer-login/actions.ts,
 * router.push("/home") in page.tsx) is a 2-line literal change already
 * confirmed via tsc/eslint/a full production build; a genuine E2E proof
 * would need new, heavier real-OTP-driving infrastructure this suite
 * doesn't have today — flagged here explicitly as a disclosed gap, not
 * silently skipped.
 */
test("Reviewer Home: regulatory widget, Requests widget (real delta), Clients widget (real delta), recent activity, idea count; /queue unaffected", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);

  function cardByTitle(p: Page, title: string) {
    return p.locator("section", { has: p.getByRole("heading", { name: title, exact: true }) });
  }

  async function readRequestsCell(p: Page, rowLabel: string, columnLabel: string): Promise<number> {
    const requestsCard = cardByTitle(p, "Requests");
    const headerCells = requestsCard.locator("thead th");
    const headerCount = await headerCells.count();
    let columnIndex = -1;
    for (let i = 0; i < headerCount; i++) {
      if ((await headerCells.nth(i).innerText()).trim() === columnLabel) {
        columnIndex = i;
        break;
      }
    }
    if (columnIndex === -1) throw new Error(`Column "${columnLabel}" not found in the Requests table header.`);
    const row = requestsCard.locator("tbody tr", { hasText: rowLabel });
    const cellText = await row.locator("td").nth(columnIndex).innerText();
    return Number(cellText.trim());
  }

  const setupFixture = await seedReviewableReport();
  await loginAsTestUser(page, setupFixture.reviewerEmail);

  // --- Baseline, before delivering anything ---
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  await step(page, testInfo, "16-reviewer-home", "01-baseline");

  const completedBefore = await readRequestsCell(page, "Core Audit", "Completed");

  // Regulatory widget — real counts, real link, same real content already
  // proven for the sidebar version (moved here 2026-09-08, not
  // duplicated).
  const regulatoryCard = cardByTitle(page, "Regulatory frameworks");
  await expect(regulatoryCard.getByText(/\d+ current/)).toBeVisible();
  await expect(regulatoryCard.getByText(/\d+ due soon/)).toBeVisible();
  await expect(regulatoryCard.getByText(/\d+ overdue/)).toBeVisible();
  await expect(regulatoryCard.getByRole("link")).toHaveAttribute("href", "/admin/regulatory-frameworks");

  // Clients widget — real total, real recently-active copy, both scoped
  // to this one Card so they can't be confused with any other number on
  // the page.
  const clientsCard = cardByTitle(page, "Clients");
  const clientsTotalBefore = Number((await clientsCard.locator("span.text-2xl").innerText()).trim());
  expect(clientsTotalBefore).toBeGreaterThan(0);
  const recentlyActiveText = await clientsCard.getByText(/paid for a service or received a report in the last \d+ days/).innerText();
  const recentlyActiveBefore = Number(recentlyActiveText.match(/^(\d+)/)?.[1] ?? "-1");
  expect(recentlyActiveBefore).toBeGreaterThanOrEqual(0);

  // Ideas widget — a real, well-formed count, not asserting a specific
  // delta (this pass doesn't seed a fresh idea).
  const ideasCard = cardByTitle(page, "Ideas");
  await expect(ideasCard.getByText(/\d+ open of \d+ total/)).toBeVisible();

  // --- Real reviewer cycle: accept every finding, approve, deliver — same pattern as 06-reviewer-approval-delivery.spec.ts ---
  await page.goto(`/review/${setupFixture.reportId}`);
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
  await step(page, testInfo, "16-reviewer-home", "02-real-report-delivered");

  // --- Real delta, after delivery ---
  await page.goto("/home");
  await step(page, testInfo, "16-reviewer-home", "03-after-delivery");

  const completedAfter = await readRequestsCell(page, "Core Audit", "Completed");
  expect(completedAfter).toBe(completedBefore + 1);

  const clientsCardAfter = cardByTitle(page, "Clients");
  const clientsTotalAfter = Number((await clientsCardAfter.locator("span.text-2xl").innerText()).trim());
  // seedReviewableReport() already created its company BEFORE the "before"
  // baseline was read above (it runs first, right at the top of the
  // test) — nothing between before/after creates a new company, only a
  // real review/approve/deliver cycle on the SAME existing one. Total
  // must therefore be genuinely unchanged, not +1 (a real bug in an
  // earlier draft of this test, caught by running it, not the app).
  expect(clientsTotalAfter).toBe(clientsTotalBefore);

  // Recently active — the real, meaningful delta. This exact company paid
  // for nothing (a real, free first Core Audit) but DID just receive a
  // real delivered report — the other half of the confirmed "paid for a
  // service OR received a report" definition, and the one this specific
  // company genuinely didn't satisfy yet at the "before" read (its report
  // was still draft findings, not yet 'sent'). Real proof both halves of
  // that OR are wired, not just the payment half already exercised
  // elsewhere (13/14/15's own real payment-confirmation deltas).
  const recentlyActiveTextAfter = await clientsCardAfter.getByText(/paid for a service or received a report in the last \d+ days/).innerText();
  const recentlyActiveAfter = Number(recentlyActiveTextAfter.match(/^(\d+)/)?.[1] ?? "-1");
  expect(recentlyActiveAfter).toBe(recentlyActiveBefore + 1);

  // Recent activity — the real delivered report shows up by company name
  // and real description. Scoped to the one <li> naming THIS test's own
  // company specifically (not a bare "Report delivered" text match) — the
  // feed genuinely has multiple real historical deliveries from other
  // companies, confirmed live via a real Playwright strict-mode
  // violation, not a hypothetical one.
  const activityCard = cardByTitle(page, "Recent activity");
  const thisCompanyActivity = activityCard.locator("li", { hasText: setupFixture.companyName });
  await expect(thisCompanyActivity).toBeVisible();
  await expect(thisCompanyActivity).toContainText("Report delivered");
  await step(page, testInfo, "16-reviewer-home", "04-recent-activity-shows-real-delivery");

  // --- /queue unaffected — still fully reachable via the sidebar, real content renders ---
  await page.getByRole("link", { name: "Queue", exact: true }).click();
  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByRole("heading", { name: "Reviewer Queue" })).toBeVisible();
  await step(page, testInfo, "16-reviewer-home", "05-queue-still-reachable");
});
