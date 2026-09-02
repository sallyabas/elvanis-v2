import { test, expect } from "@playwright/test";
import { step } from "./support/screenshot";

/**
 * Flow 1: landing page load and CTA visibility — confirmed 2026-09-02.
 * Public, unauthenticated — no test-auth bypass needed.
 */
test.describe("01 landing page", () => {
  test("loads and every primary CTA is visible with the correct destination", async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Your AI Readiness Review, before they ask/i })).toBeVisible();
    await step(page, testInfo, "01-landing-page", "01-hero");

    // "Start your AI Readiness Review" and "Book a demo" both appear twice
    // on this page (hero + a later section further down) — confirmed live
    // via a real strict-mode-violation on the first run, not assumed.
    // .first() scopes each to the hero's own copy specifically.
    const primaryCta = page.getByRole("link", { name: "Start your AI Readiness Review" }).first();
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/client-login");

    const bookDemo = page.getByRole("link", { name: "Book a demo" }).first();
    await expect(bookDemo).toBeVisible();
    await expect(bookDemo).toHaveAttribute("href", "https://calendly.com/elvanis-app/30min");

    await page.getByRole("link", { name: "Modules", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Three reviews\. One matched to what's actually at stake\./i })).toBeVisible();
    await step(page, testInfo, "01-landing-page", "02-modules");

    await page.getByRole("link", { name: "Pricing", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pricing", exact: true })).toBeVisible();
    await step(page, testInfo, "01-landing-page", "03-pricing");

    await page.getByRole("link", { name: "FAQ", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
    await step(page, testInfo, "01-landing-page", "04-faq");
  });
});
