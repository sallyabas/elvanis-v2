import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedReviewableReport } from "./support/seed";
import { step } from "./support/screenshot";

/**
 * /company/[companyId], reorganized per-request grouping (confirmed
 * 2026-09-08, final status-flow spec, item 6) — real coverage for the
 * three real pieces this reorganization built, not just a visual
 * re-check: (1) finding feedback resolved and grouped under its real
 * parent request (no schema change, two batched lookups — see
 * page.tsx's own docblock), (2) reviewer notes tied to a specific
 * request via the new relatedEntityType/relatedEntityId columns, landing
 * under that request rather than in General Reviewer Notes, and (3) the
 * terminal/historical collapse — a delivered report collapses into a
 * closed <details> by default.
 *
 * Same fixture/flow as 06-reviewer-approval-delivery.spec.ts (accept
 * every finding, approve, deliver) — this spec picks up right where that
 * one's own proof leaves off, on the SAME kind of real delivered report,
 * to exercise the reorganized company page specifically.
 */
test("Company page: finding feedback under its own request, per-request reviewer notes, terminal collapse, pilot toggle, general notes stay general", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);

  const fixture = await seedReviewableReport();

  // --- Reviewer: accept every finding, approve, deliver (same pattern as spec 06) ---
  await loginAsTestUser(page, fixture.reviewerEmail);
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
  await step(page, testInfo, "17-company-page-reorg", "01-delivered");

  // --- Client: real "Doesn't apply to us?" feedback on one real finding ---
  await loginAsTestUser(page, fixture.clientEmail);
  await page.goto(`/reports/${fixture.reportId}`);
  // Scoped to the leaf-level finding-card div specifically (rounded-lg,
  // per the client report page's own real finding-card markup) — a plain
  // `div` scope also matches bigger ancestor sections containing this
  // title text plus a DIFFERENT finding's own button, a real strict-mode
  // violation confirmed live, not a hypothetical one.
  const flaggedFindingCard = page.locator("div.rounded-lg", { hasText: "Core Feature Adoption Below Healthy Range" });
  await flaggedFindingCard.first().getByRole("button", { name: "Doesn't apply to us?" }).click();
  await expect(page.getByText("Noted as not applicable")).toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "17-company-page-reorg", "02-client-flagged-feedback");

  // --- Reviewer: the reorganized company page ---
  await loginAsTestUser(page, fixture.reviewerEmail);
  await page.goto(`/company/${fixture.companyId}`);
  await expect(page.getByRole("heading", { name: fixture.companyName, exact: true })).toBeVisible();
  await step(page, testInfo, "17-company-page-reorg", "03-company-page-loaded");

  // Terminal collapse — a real 'sent' report starts CLOSED by default.
  const reportUnit = page.locator("details", { hasText: "Core Audit" }).filter({ hasText: "submitted" });
  await expect(reportUnit.first()).toBeVisible();
  await expect(reportUnit.first()).not.toHaveAttribute("open", "");

  // Expand it — real content should now be reachable.
  await reportUnit.first().locator("summary").click();
  await expect(reportUnit.first()).toHaveAttribute("open", "");
  await step(page, testInfo, "17-company-page-reorg", "04-report-unit-expanded");

  // Finding feedback resolved and grouped under THIS specific report —
  // the real point of this whole reorganization piece.
  await expect(reportUnit.first().getByText("Core Feature Adoption Below Healthy Range")).toBeVisible();
  await expect(reportUnit.first().getByText(/Does this apply to us.*findings/i)).toBeVisible();

  // Per-request reviewer note — added HERE, must land under this
  // specific request, not in General Reviewer Notes below.
  await reportUnit.first().getByRole("button", { name: "+ Add a note about this request" }).click();
  await reportUnit.first().getByLabel("Name").fill("Discussed with client");
  await reportUnit.first().getByLabel("Description").fill("Walked through the margin finding on a real call, no further action needed.");
  await reportUnit.first().getByRole("button", { name: "Add entry" }).click();
  await expect(reportUnit.first().getByText("Discussed with client")).toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "17-company-page-reorg", "05-per-request-note-added");

  // General Reviewer Notes — must NOT show this per-request note.
  const generalNotesSection = page.locator("section", { has: page.getByRole("heading", { name: "General Reviewer Notes" }) });
  await expect(generalNotesSection).toBeVisible();
  await expect(generalNotesSection.getByText("Discussed with client")).not.toBeVisible();
  await step(page, testInfo, "17-company-page-reorg", "06-general-notes-unaffected");

  // A real, separate general note — added via Group 3's own panel, must
  // NOT appear inside the report unit.
  await generalNotesSection.getByRole("button", { name: "+ Add entry" }).click();
  await generalNotesSection.getByLabel("Name").fill("General relationship note");
  await generalNotesSection.getByLabel("Description").fill("Long-standing client, generally responsive.");
  await generalNotesSection.getByRole("button", { name: "Add entry" }).click();
  await expect(generalNotesSection.getByText("General relationship note")).toBeVisible({ timeout: 10_000 });
  await expect(reportUnit.first().getByText("General relationship note")).not.toBeVisible();
  await step(page, testInfo, "17-company-page-reorg", "07-general-note-stays-general");

  // Pilot client toggle — still works, unaffected by the reorganization.
  const pilotButton = page.getByRole("button", { name: /Mark as pilot client/ });
  await pilotButton.click();
  await expect(page.getByRole("button", { name: /Pilot client \(unmark\)/ })).toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "17-company-page-reorg", "08-pilot-toggle-works");
});
