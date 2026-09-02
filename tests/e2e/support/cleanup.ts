import { createTestAdminClient } from "./db";
import { TEST_EMAIL_DOMAIN } from "./testEmail";

/**
 * Deletes every E2E test account this suite has ever created, confirmed
 * 2026-09-02 — run as Playwright's globalSetup (before) AND globalTeardown
 * (after), so a crashed prior run never leaves stale data for the next one
 * to trip over, and a normal run doesn't accumulate real rows on every
 * future deploy's test pass.
 *
 * Deliberately simple: every table a test account's data lives in
 * (`companies`, `goals`, `reports`, `lens_findings`,
 * `pending_evidence_submissions`, `evidence_intake_drafts`,
 * `session_requests`, ...) cascades from `public.users.id` -> `companies`
 * -> everything else via real `on delete cascade` foreign keys (confirmed
 * by reading supabase/migrations/20260731090054_init_schema.sql directly),
 * and `public.users.id` itself cascades from `auth.users.id`. Deleting the
 * `auth.users` row is therefore sufficient — no per-table deletes needed,
 * unlike the manual scratch-cleanup scripts used earlier this session
 * before this suite existed.
 */
export async function cleanupTestData(): Promise<{ deletedCount: number }> {
  const supabase = createTestAdminClient();

  let deletedCount = 0;
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`cleanup: listUsers failed: ${error.message}`);

    const testUsers = data.users.filter((u) => u.email?.toLowerCase().endsWith(`@${TEST_EMAIL_DOMAIN}`));
    for (const u of testUsers) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(u.id);
      if (deleteError) {
        // eslint-disable-next-line no-console
        console.warn(`cleanup: failed to delete ${u.email} (${u.id}): ${deleteError.message}`);
        continue;
      }
      deletedCount += 1;
    }

    if (data.users.length < perPage) break;
    page += 1;
  }

  return { deletedCount };
}

if (require.main === module) {
  cleanupTestData()
    .then(({ deletedCount }) => {
      // eslint-disable-next-line no-console
      console.log(`Deleted ${deletedCount} E2E test account(s).`);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
}
