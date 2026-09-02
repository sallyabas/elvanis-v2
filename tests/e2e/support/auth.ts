import type { Page } from "@playwright/test";

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
