import { NextResponse } from "next/server";
import { checkAndNotifyClosedEditWindows } from "@/lib/reviewer/notifications";
import { runPendingAiOpportunitySynthesis } from "@/lib/synthesis/run-pending-synthesis";
import { checkReAuditReminders } from "@/lib/reviewer/re-audit-reminders";
import { checkEvidenceCompletenessNudges } from "@/lib/reviewer/evidence-nudges";
import { checkRegulatoryContentReviewDue } from "@/lib/reviewer/regulatory-content-review";
import { checkSprintProgressCheckins } from "@/lib/execution-sprint/progress-checkins";
import { sendPendingNotifications } from "@/lib/notifications/dispatch";

/**
 * The single production cron entry point (confirmed 2026-08-02, second
 * item in the confirmed pre-launch order after reviewer auth). Vercel Cron
 * calls this on a schedule (see vercel.json) with an
 * `Authorization: Bearer $CRON_SECRET` header it sets automatically from
 * the project's CRON_SECRET env var — this route rejects anything else.
 *
 * Each check runs independently, same Promise.allSettled-style resilience
 * principle used for the 5 lenses (spec §2.1): one check failing (e.g. a
 * Groq quota error inside AI Opportunity Synthesis) must never block the
 * others (e.g. the edit-window notification check, which is the one with
 * an actual "must fire the instant" timing requirement).
 */
async function runCheck<T>(name: string, fn: () => Promise<T>): Promise<{ name: string; result?: T; error?: string }> {
  try {
    return { name, result: await fn() };
  } catch (e) {
    return { name, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks = await Promise.all([
    runCheck("editWindowNotifications", checkAndNotifyClosedEditWindows),
    runCheck("aiOpportunitySynthesis", runPendingAiOpportunitySynthesis),
    runCheck("reAuditReminders", checkReAuditReminders),
    runCheck("evidenceCompletenessNudges", checkEvidenceCompletenessNudges),
    runCheck("regulatoryContentReviewDue", checkRegulatoryContentReviewDue),
    runCheck("sprintProgressCheckins", checkSprintProgressCheckins),
  ]);

  // Runs after the checks above, not alongside them in the same
  // Promise.all — so any `notifications` row created by this exact tick
  // (confirmed 2026-08-04, Priority 2) gets sent immediately rather than
  // waiting for the next tick.
  const dispatchResult = await runCheck("sendPendingNotifications", sendPendingNotifications);

  return NextResponse.json({ ranAt: new Date().toISOString(), checks: [...checks, dispatchResult] });
}
