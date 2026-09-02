import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser } from "./support/auth";
import { seedMinimalClient } from "./support/seed";
import { step } from "./support/screenshot";

/**
 * Flow 5: logged-in dashboard -> sidebar navigation to every page,
 * desktop and mobile — confirmed 2026-09-02.
 *
 * Runs under both the "desktop" and "mobile" Playwright projects (see
 * playwright.config.ts — this is the one spec explicitly scoped to run
 * under both). Below `lg` (1024px, per SidebarShell.tsx), the sidebar is
 * an off-canvas drawer behind a hamburger button; at `lg`+, it's the
 * always-visible fixed sidebar. `openSidebarIfCollapsed()` below detects
 * which case applies from the real viewport width, rather than branching
 * on the Playwright project name — the actual rendering breakpoint is
 * what matters, not which project happened to run it.
 */
async function openSidebarIfCollapsed(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
}

// Real bug found live, not assumed: several pages (Services, Account
// Settings, ...) have their own inline content links sharing an exact name
// with a sidebar link (e.g. a "Dashboard" cross-link in page copy) — a
// bare page.getByRole("link", {name, exact: true}) is ambiguous once both
// exist in the DOM at once, which only actually manifested as a strict-
// mode-violation failure under the mobile drawer (the sidebar's own <aside>
// stays in the DOM, just translated off-screen, so both matches are always
// present regardless of viewport — this wasn't a mobile-specific bug, just
// one the desktop run's own click order never happened to trigger).
//
// Scoped to the sidebar's <aside> element (implicit ARIA role
// "complementary"), not its inner <nav> — a second real bug found live:
// "Account Settings" and "Sign out" live in AppSidebar.tsx's own footer
// <div>, a sibling of <nav>, not inside it, so scoping to the navigation
// landmark specifically made that one link genuinely unfindable (a real
// 30s timeout, not a flake). "complementary" covers the whole sidebar,
// both the nav links and the footer.
function navLink(page: Page, name: string) {
  return page.getByRole("complementary").getByRole("link", { name, exact: true });
}

// Deliberately asserted via getByRole("heading", ...), not a bare text
// match — several of these link names ("Signals", "Reports & History",
// "Services", "Account Settings") are identical to the sidebar's own
// always-visible link text, so a plain page.getByText() match would false-
// positive against the sidebar itself rather than proving the target
// page's real content actually loaded.
const NAV_TARGETS: { linkName: string; expectedHeading: string | RegExp }[] = [
  { linkName: "Business Diagnosis", expectedHeading: "Submit your evidence" },
  // A fresh minimal-seeded client has no saved triage answers yet, so
  // /ai-audit starts at its triage screen (confirmed via PathBWizard.tsx:
  // attach mode always skips the 5-field profile, and startAtTriage is
  // true whenever no triage_* columns are set) — not the recommendation
  // screen, which only shows once triage answers already exist.
  { linkName: "AI Audit", expectedHeading: "A couple of quick questions" },
  { linkName: "Signals", expectedHeading: "Signals" },
  { linkName: "Reports & History", expectedHeading: "Reports & History" },
  { linkName: "Services", expectedHeading: "Services" },
  { linkName: "Account Settings", expectedHeading: "Account Settings" },
];

test("Sidebar navigation reaches every page from Dashboard", async ({ page }, testInfo) => {
  const { email } = await seedMinimalClient();
  await loginAsTestUser(page, email);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await step(page, testInfo, "05-sidebar-nav", "00-dashboard");

  for (const [i, target] of NAV_TARGETS.entries()) {
    await openSidebarIfCollapsed(page);
    await navLink(page, target.linkName).click();
    await expect(page.getByRole("heading", { name: target.expectedHeading }).first()).toBeVisible({ timeout: 10_000 });
    await step(page, testInfo, "05-sidebar-nav", `${String(i + 1).padStart(2, "0")}-${target.linkName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);

    // Back to Dashboard between each nav check, matching the flow the
    // founder asked for ("Dashboard -> sidebar navigation to every page"),
    // not a chain of page-to-page hops.
    await openSidebarIfCollapsed(page);
    await navLink(page, "Dashboard").click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  }
});
