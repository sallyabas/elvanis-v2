/**
 * Real-function-call bridge for the E2E suite (confirmed 2026-09-05) — a
 * Playwright spec's own dynamic `import("../../src/lib/...")` cannot
 * resolve this app's `@/` tsconfig path aliases (confirmed live: a real
 * `Cannot find module '@/lib/supabase/admin'` error, since Playwright's
 * test-runner module resolution is a different context from Next.js's
 * own build pipeline or a standalone `npx tsx` invocation). Real app
 * functions that a test genuinely needs to call directly (not through the
 * browser) are called from a plain, standalone script instead — run via
 * `npx tsx --env-file=.env.local`, the same invocation style this
 * codebase's own scratch/test-case scripts have always used, which DOES
 * resolve `@/` aliases correctly — and the Playwright spec spawns this as
 * a child process, reading its JSON stdout for the result. This is the
 * same "reviewer-side proven via direct function call" precedent already
 * established throughout this codebase's own history, just invoked from
 * a spec file instead of an ad hoc scratch script.
 */
import { sendPendingNotifications } from "@/lib/notifications/dispatch";
import { proposeSprintFinding, confirmSprintFinding, approveSprintTasks } from "@/lib/execution-sprint/workspace";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function main() {
  const [task, ...args] = process.argv.slice(2);

  if (task === "dispatch-notifications") {
    const result = await sendPendingNotifications();
    console.log(JSON.stringify(result));
    return;
  }

  if (task === "create-and-approve-sprint") {
    const [reportId, findingId] = args;
    const proposeResult = await proposeSprintFinding(reportId, findingId);
    await confirmSprintFinding(proposeResult.sprintId, findingId);
    const supabase = adminClient();
    const { error: updateError } = await supabase.from("sprint_tasks").update({ reviewer_status: "approved" }).eq("execution_sprint_id", proposeResult.sprintId);
    if (updateError) throw new Error(`sprint_tasks bulk-approve failed: ${updateError.message}`);
    const approveResult = await approveSprintTasks(proposeResult.sprintId);
    console.log(JSON.stringify({ sprintId: proposeResult.sprintId, ...approveResult }));
    return;
  }

  throw new Error(`Unknown task: ${task}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
