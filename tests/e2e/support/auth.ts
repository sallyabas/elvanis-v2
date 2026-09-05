import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Establishes a real, valid session for `email` via the gated
 * `/api/test/auth` route (see that file's own docblock for the full
 * reasoning) — confirmed 2026-09-02.
 *
 * Uses `page.request`, not a bare `fetch`: Playwright's `page.request`
 * shares the same cookie jar as the page's own browser context, so the
 * Set-Cookie headers this route returns are automatically stored and used
 * by every subsequent `page.goto()` in the test — no manual cookie
 * plumbing needed.
 */
export async function loginAsTestUser(page: Page, email: string): Promise<void> {
  const secret = process.env.TEST_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "TEST_AUTH_SECRET is not set. The E2E suite needs this (matching the ALLOW_TEST_AUTH-gated app env) to authenticate test users — see .env.local.example.",
    );
  }

  const response = await page.request.post("/api/test/auth", {
    headers: { "x-test-auth-secret": secret, "content-type": "application/json" },
    data: { email },
  });

  if (!response.ok()) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `/api/test/auth returned ${response.status()} for ${email} — is ALLOW_TEST_AUTH=true set on the server this suite is targeting? Body: ${body}`,
    );
  }
}

/**
 * Fills the shared, mandatory Email/Name/Phone contact fields
 * (ContactFieldsForm.tsx, confirmed 2026-09-05) rendered directly inside
 * a SessionRequestButton widget — a real, self-caused regression this
 * fixes: test fixtures never seed `users.name`/`phone`, so those two
 * fields render genuinely blank, and requestSession()'s own click handler
 * silently no-ops (no error, no navigation) rather than submitting an
 * invalid request — exactly the "element(s) not found" failure this
 * helper closes. Email is left untouched (already pre-filled correctly
 * from the real signed-in test user's own address via
 * getContactFieldDefaults()).
 *
 * Takes the specific "Request ..." BUTTON locator, not the page/a
 * container — several real pages (Services, the client report page) can
 * render more than one SessionRequestButton widget side by side (e.g.
 * Concierge + Discovery + Delivery + Training & Advisory all on
 * /services), each with its own Name/Phone inputs sharing the identical
 * label text; a page- or fixed-container-scoped fill would hit a real
 * Playwright strict-mode violation the moment more than one is present.
 * Scoping via the button's own ancestor wrapper (SessionRequestButton's
 * single `rounded-md` div) is what actually disambiguates correctly
 * regardless of how many widgets share the page.
 */
export async function fillSessionRequestContactFields(button: Locator): Promise<void> {
  const container = button.locator("xpath=ancestor::div[contains(@class,'rounded-md')][1]");
  // Real race found live, not assumed: getContactFieldDefaults() resolves
  // asynchronously after mount and OVERWRITES whatever's already typed
  // into Name/Phone with the fetched defaults — which are genuinely blank
  // for these test fixtures (users.name/phone are never seeded). Filling
  // before that async effect settles gets silently clobbered a moment
  // later, with no error thrown (the fields end up blank, not the fill
  // call failing). Email always resolves to a real, non-blank value (the
  // signed-in test user's own address) regardless of profile state, so
  // waiting for it to actually appear is a real, concrete signal the
  // async default-fetch has genuinely landed — not an arbitrary timeout.
  await expect(container.getByLabel("Email", { exact: true })).not.toHaveValue("");
  await container.getByLabel("Name", { exact: true }).fill("Playwright Test Contact");
  await container.getByLabel("Phone", { exact: true }).fill("+44 7700 900123");
}
