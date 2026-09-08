import { test, expect } from "@playwright/test";
import { loginAsTestUser, fillSessionRequestContactFields } from "./support/auth";
import { seedSessionLifecycleFixtures } from "./support/sessionLifecycle";
import { step } from "./support/screenshot";

/**
 * Contact Sales — Refund reachable from 'Booked', and the price field's
 * disabled/editable behavior across the whole lifecycle (confirmed
 * 2026-09-08, final status-flow spec, item 3) — a real, distinct branch
 * from 08-session-booking-lifecycle.spec.ts's own Requested -> Booked ->
 * Completed happy path, which never reaches Refund at all. Real gaps
 * closed by item 3 this suite is specifically proving:
 *   - Refund used to only be reachable from 'Completed' — widened to
 *     also work directly from 'Booked' ("if something needs undoing
 *     after the fact" no longer requires having reached Completed
 *     first).
 *   - The price field is genuinely disabled (not just visually) until
 *     'Booked', then becomes editable, and — the one piece with no
 *     precedent anywhere else in this codebase — stays editable even
 *     after the record reaches the terminal 'Refunded' state
 *     specifically, so a partial refund (e.g. £500 charged, £250 kept)
 *     can be recorded honestly instead of the field going silently mute.
 *
 * A fresh fixture, not a reuse of 08's own Concierge row — that row is
 * already driven to 'Completed' by the time it's done, and Refund-from-
 * Booked is a genuinely different branch requiring its own 'Booked'
 * starting point.
 */
test("Contact Sales: Refund reachable from Booked, price field disabled until Booked and editable after Refund", async ({ page }, testInfo) => {
  const fixtures = await seedSessionLifecycleFixtures();

  await loginAsTestUser(page, fixtures.clientEmail);
  await page.goto("/services");
  const conciergeRequestButton = page.getByRole("button", { name: /Request Concierge/i });
  await fillSessionRequestContactFields(conciergeRequestButton);
  await conciergeRequestButton.click();
  await expect(page.getByText("Concierge inquiry sent")).toBeVisible();
  await step(page, testInfo, "15-contact-sales-refund", "01-concierge-requested");

  await loginAsTestUser(page, fixtures.reviewerEmail);
  await page.goto(`/company/${fixtures.companyId}`);
  const conciergeRow = page.locator("details", { hasText: "Concierge Inquiry" });
  const statusSelect = conciergeRow.locator("select").first();
  await expect(statusSelect).toHaveValue("requested");

  // Price genuinely disabled while Requested (item 3: "genuinely disabled
  // and unusable, not just empty").
  const priceFieldDisabled = conciergeRow.getByPlaceholder("Set once Booked");
  await expect(priceFieldDisabled).toBeDisabled();
  await step(page, testInfo, "15-contact-sales-refund", "02-price-disabled-while-requested");

  // Requested -> Booked.
  await statusSelect.selectOption("booked");
  await conciergeRow.getByRole("button", { name: "Update" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(statusSelect).toHaveValue("booked", { timeout: 10_000 });

  // Price now active/editable (item 3) — set a real charged amount.
  const priceFieldActive = conciergeRow.getByPlaceholder("£ price");
  await expect(priceFieldActive).toBeEnabled();
  await priceFieldActive.fill("500");
  await conciergeRow.getByRole("button", { name: "Update" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(conciergeRow.locator('input[type="number"]').first()).toHaveValue("500");
  await step(page, testInfo, "15-contact-sales-refund", "03-booked-price-set-to-500");

  // Refund — directly from 'Booked', the real widened reachability this
  // test exists to prove (was 'Completed'-only before 2026-09-08).
  const conciergeRowAfterBooked = page.locator("details", { hasText: "Concierge Inquiry" });
  const refundReasonField = conciergeRowAfterBooked.getByPlaceholder("Refund reason (optional)");
  await expect(refundReasonField).toBeVisible();
  await refundReasonField.fill("Client changed scope after booking — half refunded.");
  await conciergeRowAfterBooked.getByRole("button", { name: "Refund" }).click();
  await expect(conciergeRowAfterBooked.getByText("Refunded", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(conciergeRowAfterBooked.getByText(/Client changed scope after booking/i)).toBeVisible();
  await step(page, testInfo, "15-contact-sales-refund", "04-refunded-from-booked");

  // Terminal 'Refunded' — the status dropdown/Cancel/Refund controls are
  // gone (nothing moves on), but the price field is NOT — real proof of
  // "the field CAN be edited after payment, specifically to reflect a
  // partial refund." Record the real net amount actually kept: £500
  // charged, half refunded, £250 retained.
  await expect(conciergeRowAfterBooked.locator("select")).not.toBeVisible();
  const netPriceField = conciergeRowAfterBooked.getByPlaceholder("£ amount retained");
  await expect(netPriceField).toBeVisible();
  await expect(netPriceField).toBeEnabled();
  await netPriceField.fill("250");
  await conciergeRowAfterBooked.getByRole("button", { name: "Update price" }).click();
  await expect(conciergeRowAfterBooked.getByText("Saved.")).toBeVisible({ timeout: 10_000 });
  await step(page, testInfo, "15-contact-sales-refund", "05-net-retained-price-edited-after-refund");

  // Real DB proof, not just UI state — the price genuinely persisted at
  // the net £250, status stays 'refunded', reason intact. Anchored via
  // the company (the fixture's own real, always-available id), not a
  // session_request id the shared fixture helper doesn't return — this
  // Concierge request was seeded fresh via the real UI above, not by
  // seedSessionLifecycleFixtures() itself.
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conciergeRequest } = await admin
    .from("session_requests")
    .select("id")
    .eq("company_id", fixtures.companyId)
    .eq("session_type", "concierge_inquiry")
    .maybeSingle();
  const { data: record } = await admin
    .from("service_status_records")
    .select("status, price, reason")
    .eq("entity_type", "session_request")
    .eq("entity_id", conciergeRequest?.id ?? "")
    .maybeSingle();
  expect(record?.status).toBe("refunded");
  expect(record?.price).toBe(250);
  expect(record?.reason).toContain("Client changed scope after booking");
});
