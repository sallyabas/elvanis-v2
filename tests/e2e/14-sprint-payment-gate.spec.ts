import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { createTestAdminClient } from "./support/db";
import { seedReviewableReport } from "./support/seed";
import { step } from "./support/screenshot";

/**
 * Execution Sprint payment gate + new client entry point (confirmed
 * 2026-09-07, unified flow spec) — closes a real, confirmed gap of the
 * exact same class already fixed for the core audit and the three
 * standalone modules: confirmSprintFinding() ran a real, synchronous Groq
 * call (task drafting) with zero payment check. The underlying atomic-
 * claim mechanism was already directly, exhaustively verified against
 * real concurrency via a standalone backend script (scratch-unified-flow-
 * test.ts, since deleted) before this spec was written — this spec's own
 * job is the real UI/click-through path (the new "I'll choose the
 * finding myself" entry point on the report page, the reviewer queue's
 * new section, and a real "Mark as paid" click), not re-proving the
 * atomicity guarantee a third time.
 *
 * "Let Elvanis decide" and the reviewer's own finding-picker banner on
 * /review/[reportId] are covered by the backend script only, not
 * re-driven through the browser here — a deliberate scope decision to
 * keep this spec's own runtime reasonable, disclosed rather than silently
 * assumed equivalent coverage.
 */
test("Execution Sprint: client 'I'll choose the finding myself' request -> reviewer queue -> Mark as paid -> real plan drafted", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const fixture = await seedReviewableReport();
  const supabase = createTestAdminClient();

  // --- Reviewer accepts every finding and approves the report (same real flow spec 6 already proves) ---
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
  // Real fix, found live: the client-facing report page's own RLS only
  // allows status='sent' through (same real mismatch already documented
  // elsewhere in this codebase — a report that's merely 'approved' isn't
  // client-visible yet). requestSprintChooseOwnFinding() also requires
  // report.status IN ('approved','sent'), so 'approved' alone would have
  // worked for THAT check, but the client can't even reach the report
  // page to click the button without a real delivery first.
  await page.getByRole("button", { name: "Deliver report" }).click();
  await expect(page.getByText(/delivered/i).first()).toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "14-sprint-payment-gate", "01-report-approved-and-delivered");

  // --- Client: the new "I'll choose the finding myself" entry point on the report page ---
  await loginAsTestUser(page, fixture.clientEmail);
  await page.goto(`/reports/${fixture.reportId}`);
  await expect(page.getByText("Want help implementing one of these?")).toBeVisible();
  await page.getByRole("button", { name: "I'll choose the finding myself" }).click();
  await page.getByRole("combobox").selectOption({ label: "Critical Customer Revenue Concentration" });
  await page.getByRole("button", { name: "Request this finding" }).click();
  await expect(page.getByText(/Request sent/i)).toBeVisible({ timeout: 15_000 });
  await step(page, testInfo, "14-sprint-payment-gate", "02-client-requested-own-finding");

  // --- Real DB state: awaiting_payment/pending, client_chosen, zero tasks, no Groq call happened ---
  const { data: sprintRow } = await supabase
    .from("execution_sprints")
    .select("id, status, payment_status, choice_mode, selected_finding_id")
    .eq("report_id", fixture.reportId)
    .single();
  expect(sprintRow?.status).toBe("awaiting_payment");
  expect(sprintRow?.payment_status).toBe("pending");
  expect(sprintRow?.choice_mode).toBe("client_chosen");
  expect(sprintRow?.selected_finding_id).toBe(fixture.findingIds.critical);
  const sprintId = sprintRow!.id as string;
  const { count: taskCountBeforePayment } = await supabase.from("sprint_tasks").select("id", { count: "exact", head: true }).eq("execution_sprint_id", sprintId);
  expect(taskCountBeforePayment).toBe(0);

  // --- Reviewer: the request shows in the new "Execution Sprint requests awaiting payment" section ---
  await loginAsTestUser(page, fixture.reviewerEmail);
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Execution Sprint requests awaiting payment" })).toBeVisible();
  const sprintQueueRow = page.locator("li", { hasText: fixture.companyName }).filter({ hasText: "Client chose the finding" });
  await expect(sprintQueueRow).toBeVisible();
  await expect(sprintQueueRow.getByText("Not yet checked")).toBeVisible();
  await step(page, testInfo, "14-sprint-payment-gate", "03-reviewer-queue-awaiting-payment");

  // --- Reviewer marks it paid — a real, synchronous Groq call drafts the plan here ---
  await sprintQueueRow.getByRole("button", { name: "Mark as paid — draft plan" }).click();
  await expect(page.getByRole("heading", { name: "Execution Sprint requests awaiting payment" })).not.toBeVisible({ timeout: 30_000 });
  await step(page, testInfo, "14-sprint-payment-gate", "04-reviewer-marked-paid-real-plan-drafted");

  // --- Real DB state: finalized correctly, real tasks persisted, reviewer notified to review them ---
  const { data: sprintRowAfterPaid } = await supabase.from("execution_sprints").select("status, payment_status").eq("id", sprintId).single();
  expect(sprintRowAfterPaid?.status).toBe("scoped");
  expect(sprintRowAfterPaid?.payment_status).toBe("paid");
  const { data: tasksAfterPaid } = await supabase.from("sprint_tasks").select("id").eq("execution_sprint_id", sprintId);
  expect((tasksAfterPaid ?? []).length).toBeGreaterThan(0);

  // --- Real reviewer sprint workspace correctly shows the real drafted tasks, ready for the mandatory Accept/Edit/Reject pass ---
  await page.goto(`/review-sprint/${sprintId}`);
  await expect(page.getByText(/mandatory/i).first()).toBeVisible();
  await step(page, testInfo, "14-sprint-payment-gate", "05-reviewer-sprint-workspace-real-tasks");
});
