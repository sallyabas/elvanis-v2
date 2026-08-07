import { LinkButton } from "@/app/_components/ui/LinkButton";
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
  return (
    <div className="mb-6 rounded-lg border border-accent/40 bg-accent/10 p-5 dark:border-accent/30 dark:bg-accent/10">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-50">{copy.title}</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{copy.body}</p>
      <LinkButton href={copy.href(journeyStatus.latestReportId)} className="mt-3">
        {copy.ctaLabel}
      </LinkButton>
    </div>
  );
}
