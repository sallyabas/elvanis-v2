/**
 * Grants (or revokes) reviewer access by email — the only way reviewer
 * access is ever granted. No reviewer email is hardcoded anywhere in the
 * app; this script is the provisioning path (confirmed 2026-08-02).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/grant-reviewer.ts <email>
 *   npx tsx --env-file=.env.local scripts/grant-reviewer.ts <email> --revoke
 *
 * If no auth.users account exists yet for the email, one is created
 * (unconfirmed email flow not needed — email_confirm: true — since the
 * person proves ownership via the magic-link they'll request themselves at
 * /reviewer-login). This script never sends any email itself.
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/grant-reviewer.ts <email> [--revoke]");
  process.exit(1);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Failed to list auth users: ${listError.message}`);

  let authUser = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!authUser) {
    if (revoke) {
      console.log(`No account exists for ${email} — nothing to revoke.`);
      return;
    }
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) throw new Error(`Failed to create auth user: ${createError.message}`);
    authUser = created.user;
    console.log(`Created new auth account for ${email} (${authUser.id})`);
  }

  const role = revoke ? "client" : "reviewer";

  const { error: upsertError } = await supabase
    .from("users")
    .upsert({ id: authUser.id, email, role }, { onConflict: "id" });
  if (upsertError) throw new Error(`Failed to upsert users row: ${upsertError.message}`);

  console.log(`${email} (${authUser.id}) is now role="${role}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
