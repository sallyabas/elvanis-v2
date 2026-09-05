import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { createTestAdminClient } from "./support/db";
import { seedModulePaymentGateFixture } from "./support/seed";
import { step } from "./support/screenshot";

/**
 * Module payment gate (confirmed 2026-09-06, direct founder decision) —
 * closes a real, confirmed gap: none of the three paid modules (Tender
 * Readiness, AI Reliability Audit, Data Protection Compliance) had any
 * payment check of any kind before running a real, synchronous Groq call
 * on every submission (£2,000-£2,500 per request). Real flow, exact
 * confirmed design:
 *   1. Client clicks a paid service -> popup shows the real price.
 *   2. Continue opens the real intake form.
 *   3. Submit -> request saved in 'awaiting_payment', NO analysis runs.
 *   4. Client sees "Your request is submitted. Continue to payment now,
 *      or it will remain pending." with a real payment link.
 *   5. Reviewer sees it in /queue under "Module requests awaiting
 *      payment" and marks it paid (runs the real analysis) or unpaid (a
 *      real, visible, revisable client-facing status).
 *
 * The underlying atomic-claim mechanism (module-payment-gate.ts) was
 * already directly, exhaustively verified against real concurrency via a
 * standalone backend script before this spec was written (5/5 scenarios:
 * create-awaiting-payment, a genuine Promise.all race between two
 * markModulePaidAndRunAnalysis() calls on the same row, refusing a
 * second call on an already-processed row, the unpaid->paid transition,
 * and refusing markModuleUnpaid() on an already-processed row) — this
 * spec's own job is the real UI/click-through path (start-confirm price,
 * the submitted notice's copy and payment link, the reviewer queue's new
 * section and both its real actions, and the client-facing "Unpaid"
 * status), not re-proving the atomicity guarantee a third time.
 */
test("Module payment gate: price shown, no analysis until paid, reviewer Mark Unpaid then Mark Paid, client sees the real status at every stage", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const fixture = await seedModulePaymentGateFixture();
  const supabase = createTestAdminClient();

  // --- Client: start-confirm popup shows the real DB-backed price ---
  await loginAsTestUser(page, fixture.clientEmail);
  await page.goto("/tender-readiness");
  await expect(page.getByText("You're starting")).toBeVisible();
  await expect(page.getByText(/^£[\d,]+$/)).toBeVisible();
  await step(page, testInfo, "12-module-payment-gate", "01-start-confirm-price");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Describe the AI systems/i).fill("A customer-facing pricing chatbot answering plan questions.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/you don't have existing documentation/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Yes, continue without documentation" }).click();

  // --- Real confirmed copy, exact — and a real, working payment link, not a placeholder ---
  await expect(page.getByText("Your request is submitted. Continue to payment now, or it will remain pending.")).toBeVisible({ timeout: 15_000 });
  const paymentLink = page.getByRole("link", { name: /Continue to payment/i });
  await expect(paymentLink).toBeVisible();
  await expect(paymentLink).toHaveAttribute("href", /payoneer\.com/);
  await step(page, testInfo, "12-module-payment-gate", "02-submitted-awaiting-payment-notice");

  // --- Real DB state: awaiting_payment/pending, zero findings, no Groq call happened ---
  const { data: rowAfterSubmit } = await supabase
    .from("module_requests")
    .select("id, status, payment_status")
    .eq("company_id", fixture.companyId)
    .eq("module_type", "tender_readiness")
    .single();
  expect(rowAfterSubmit?.status).toBe("awaiting_payment");
  expect(rowAfterSubmit?.payment_status).toBe("pending");
  const requestId = rowAfterSubmit!.id as string;
  const { count: findingCountBeforePayment } = await supabase.from("module_findings").select("id", { count: "exact", head: true }).eq("request_id", requestId);
  expect(findingCountBeforePayment).toBe(0);

  // --- Client Dashboard: real "awaiting payment" status shown, before any reviewer action ---
  await page.goto("/dashboard");
  await expect(page.getByText("Submitted — awaiting payment")).toBeVisible();
  await step(page, testInfo, "12-module-payment-gate", "03-dashboard-awaiting-payment");

  // --- Reviewer: the request shows in the new "Module requests awaiting payment" section ---
  await loginAsTestUser(page, fixture.reviewerEmail);
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Module requests awaiting payment" })).toBeVisible();
  const queueRow = page.locator("li", { hasText: fixture.companyName });
  await expect(queueRow).toBeVisible();
  await step(page, testInfo, "12-module-payment-gate", "04-reviewer-queue-awaiting-payment");

  // --- Reviewer marks it unpaid first (a real, revisable outcome — not a dead end) ---
  await queueRow.getByRole("button", { name: "Mark as unpaid" }).click();
  await expect(queueRow.getByText("Unpaid")).toBeVisible({ timeout: 10_000 });
  // Real design: once unpaid, "Mark as unpaid" is hidden (already unpaid), only "Mark as paid" remains.
  await expect(queueRow.getByRole("button", { name: "Mark as unpaid" })).not.toBeVisible();
  await step(page, testInfo, "12-module-payment-gate", "05-reviewer-marked-unpaid");

  const { data: rowAfterUnpaid } = await supabase.from("module_requests").select("status, payment_status").eq("id", requestId).single();
  expect(rowAfterUnpaid?.status).toBe("awaiting_payment");
  expect(rowAfterUnpaid?.payment_status).toBe("unpaid");

  // --- Client sees the real "Unpaid" status, not a stuck "awaiting payment" ---
  await loginAsTestUser(page, fixture.clientEmail);
  await page.goto("/dashboard");
  await expect(page.getByText("Unpaid", { exact: true })).toBeVisible();
  await expect(page.getByText("Your reviewer checked and hasn't received payment yet")).toBeVisible();
  await step(page, testInfo, "12-module-payment-gate", "06-client-sees-unpaid");

  // --- Reviewer changes their mind and marks it paid — the real, synchronous Groq call runs here ---
  await loginAsTestUser(page, fixture.reviewerEmail);
  await page.goto("/queue");
  await page.locator("li", { hasText: fixture.companyName }).getByRole("button", { name: "Mark as paid — run analysis" }).click();
  // A real Groq call, not instant — same generous timeout already
  // established elsewhere in this suite for real analysis runs.
  //
  // Real test-design fix, found live running the full suite together
  // (not in isolation): asserting the WHOLE "Module requests awaiting
  // payment" section disappears is wrong when this spec runs alongside
  // 11-combinatorial-coverage.spec.ts, which deliberately leaves other
  // companies' real module requests sitting in 'awaiting_payment'
  // forever (never marks them paid — not this app's job, its own test's
  // job) — the section correctly stays visible for THOSE, which isn't a
  // bug. Scoped to this fixture's own company row specifically instead.
  await expect(page.locator("li", { hasText: fixture.companyName }).getByRole("button", { name: "Mark as paid" })).not.toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Ready for review" })).toBeVisible();
  await expect(page.locator("h3", { hasText: fixture.companyName })).toBeVisible();
  await step(page, testInfo, "12-module-payment-gate", "07-reviewer-marked-paid-real-analysis-ran");

  // --- Real DB state: finalized correctly, real findings persisted, a real reviewer notification fired for the next stage ---
  const { data: rowAfterPaid } = await supabase.from("module_requests").select("status, payment_status, intake_data").eq("id", requestId).single();
  expect(rowAfterPaid?.status).toBe("pending_review");
  expect(rowAfterPaid?.payment_status).toBe("paid");
  expect((rowAfterPaid?.intake_data as { applicability?: unknown } | null)?.applicability).toBeTruthy();

  const { data: findingsAfterPaid } = await supabase.from("module_findings").select("id").eq("request_id", requestId);
  expect((findingsAfterPaid ?? []).length).toBeGreaterThan(0);
});
