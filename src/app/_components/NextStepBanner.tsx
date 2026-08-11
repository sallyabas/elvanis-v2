import { LinkButton } from "@/app/_components/ui/LinkButton";
import { EditWindowCountdown } from "@/app/_components/EditWindowCountdown";
import type { JourneyStatus } from "@/lib/reports/journey-status";

/**
 * Real UX gap closed, confirmed 2026-08-07 — a first-time client landing on
 * Business Profile after onboarding had no indication of what to do next
 * and no link into Evidence Intake; the Dashboard's empty state existed but
 * was easy to miss (unstyled, no visual weight). Same `computeJourneyStatus`
 * (see src/lib/reports/journey-status.ts) drives both, so the two pages
 * can't describe the client's own state differently to each other.
 *
 * Deliberately its own small, amber-accented callout — distinct from the
 * neutral form Cards around it — since this is the one thing on the page
 * that's an action prompt, not a data-entry field.
 */
const COPY: Record<JourneyStatus["stage"], { title: string; body: string; ctaLabel: string; href: (reportId: string | null) => string }> = {
  no_evidence: {
    title: "Next: submit your evidence",
    body: "Your business profile is set up. Submit your evidence to start your audit — it takes about 15–20 minutes, and you can save a draft partway through.",
    ctaLabel: "Submit evidence",
    href: () => "/evidence-intake",
  },
  // Three new stages, confirmed 2026-08-10 (delayed-execution
  // architecture) — none of these have a reportId yet, since a `reports`
  // row is now only ever created once the audit actually runs. All three
  // route back to /evidence-intake, which itself correctly renders the
  // editable form or the locked status view depending on which of these
  // stages is current (see that page's own logic).
  editing: {
    // body is overridden below with a real live countdown (confirmed
    // 2026-08-10, live testing pass) — this static string is only the
    // fallback for the rare case editWindowClosesAt wasn't set (defensive,
    // shouldn't happen for a genuinely 'editing'-stage status).
    title: "Your evidence is saved — you can still make changes",
    body: "Head back to add more or revise anything before your edit window closes.",
    ctaLabel: "Continue editing",
    href: () => "/evidence-intake",
  },
  queued_for_audit: {
    title: "Your evidence is queued for analysis",
    body: "Your edit window has closed and your evidence is locked in — we'll start analyzing it on our next scheduled run.",
    ctaLabel: "Check status",
    href: () => "/evidence-intake",
  },
  audit_in_progress: {
    title: "Your evidence is being analyzed",
    body: "This usually takes under a minute — check back shortly.",
    ctaLabel: "Check status",
    href: () => "/evidence-intake",
  },
  in_review: {
    title: "Your evidence is being reviewed",
    body: "We're reviewing your submission — you'll get an email once your report is ready.",
    ctaLabel: "Check status",
    href: (reportId) => `/reports/${reportId}`,
  },
  has_report: {
    title: "Your report is ready",
    body: "Your latest audit report is ready to view, with your top-3 priorities and a 30/60/90 day plan.",
    ctaLabel: "View report",
    href: (reportId) => `/reports/${reportId}`,
  },
};

export function NextStepBanner({ journeyStatus }: { journeyStatus: JourneyStatus }) {
  const copy = COPY[journeyStatus.stage];
  // Real live countdown (confirmed 2026-08-10, live testing pass) — closes
  // a real gap: this banner previously showed a one-time static message
  // with no ongoing indication of how much of the edit window was left.
  // Persistent here, not a one-time toast: every time this banner renders
  // while stage is 'editing', it shows a real, ticking countdown against
  // the actual edit_window_closes_at value.
  const showCountdown = journeyStatus.stage === "editing" && journeyStatus.editWindowClosesAt;
  return (
    <div className="mb-6 rounded-lg border border-accent/40 bg-accent/10 p-5 dark:border-accent/30 dark:bg-accent/10">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-50">{copy.title}</h2>
      {showCountdown ? (
        // Explicit, not a bare number (confirmed 2026-08-11, direct
        // founder feedback: "paired with clear, explicit language... not
        // just a bare number without context") — "you still have" +
        // "to review and change" states outright what the timer means and
        // what it's counting down to lose, instead of assuming the reader
        // already knows what "closes in 23h 59m" implies.
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          You still have <EditWindowCountdown closesAt={journeyStatus.editWindowClosesAt!} /> to review and change
          anything in your submission — after that, review begins automatically.
        </p>
      ) : (
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{copy.body}</p>
      )}
      <LinkButton href={copy.href(journeyStatus.latestReportId)} className="mt-3">
        {copy.ctaLabel}
      </LinkButton>
    </div>
  );
}
