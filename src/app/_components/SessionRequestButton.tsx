"use client";

import { useState } from "react";
import { requestSession, type SessionType } from "@/lib/service-layer/session-requests";
import { Alert } from "@/app/_components/ui/Alert";

// Framing text + spelled-out F2F wording added 2026-08-06 (honest UX
// review pass) — the report page previously offered Delivery Session and
// F2F Workshop with zero explanation of what either actually was (unlike
// Discovery Session on the intake page, which already had a one-line
// description above it), and "F2F Workshop" appeared as bare internal
// shorthand in client-facing copy.
const LABELS: Record<SessionType, { cta: string; sentLabel: string; description: string }> = {
  discovery: {
    cta: "Request a Discovery Session",
    sentLabel: "Discovery Session requested",
    description: "A short optional call before you submit your evidence — never required.",
  },
  delivery: {
    cta: "Request a Delivery Session",
    sentLabel: "Delivery Session requested",
    description: "A call with your reviewer to walk through these findings together and talk through what's realistic to tackle first.",
  },
  f2f_workshop: {
    cta: "Request a Face-to-Face (F2F) Workshop",
    sentLabel: "Face-to-Face (F2F) Workshop requested",
    description: "An in-person, multi-stakeholder version of the Delivery Session — for working through priorities with your whole team in the room.",
  },
  // Concierge "Contact Sales" (confirmed 2026-08-24) — exact founder-
  // specified copy, reusing this same component/mechanism rather than a
  // new one.
  concierge_inquiry: {
    cta: "Contact Sales",
    sentLabel: "Concierge inquiry sent",
    description:
      "Deeper reviewer attention on your audit, plus your Discovery and Delivery Sessions bundled in — scoped with you personally, not a checkout.",
  },
  // "compliance_consultation" (added 2026-08-27, Onboarding Architecture &
  // Path Routing brief, Part 3) is never actually requested through THIS
  // generic button — it's created directly by the Path B onboarding flow
  // (an active compliance/procurement request routes there automatically,
  // not via a client-initiated "request a session" click). This entry
  // exists only to satisfy SessionType's exhaustiveness; if it's ever
  // wired to this button, this copy is the real, ready-to-use text.
  compliance_consultation: {
    cta: "Request a compliance consultation",
    sentLabel: "Compliance consultation requested",
    description: "A direct conversation with your reviewer about an active compliance, procurement, or investor request.",
  },
};

/**
 * Service Layer session requests, client-facing (confirmed 2026-08-06) —
 * no calendar/payment integration exists, so this is a real request +
 * human follow-up, not a fake booking flow. Shared across the two client
 * surfaces that offer a session request (evidence-intake for Discovery,
 * the delivered-report page for Delivery/F2F Workshop) — kept here rather
 * than duplicated per route, unlike this codebase's usual "one small
 * component per route group" convention, since the three variants are
 * genuinely identical apart from copy.
 */
export function SessionRequestButton({ companyId, sessionType }: { companyId: string; sessionType: SessionType }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setStatus("sending");
    setError(null);
    const result = await requestSession(companyId, sessionType, null);
    if (result.success) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  if (status === "sent") {
    return <Alert variant="success">{LABELS[sessionType].sentLabel} — we&apos;ll follow up to schedule it.</Alert>;
  }

  // Self-contained framed widget, not just a bare button (confirmed
  // 2026-08-06, honest UX review) — every use of this component now
  // carries its own one-line explanation of what the session actually is,
  // same framing pattern Discovery Session already used on the intake
  // page, instead of a page having to remember to write its own
  // surrounding paragraph (or, as on the report page before this fix,
  // not writing one at all).
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">{LABELS[sessionType].description}</p>
      <button
        type="button"
        onClick={handleRequest}
        disabled={status === "sending"}
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-40"
      >
        {status === "sending" ? "Requesting…" : LABELS[sessionType].cta}
      </button>
      {status === "error" && error && (
        <Alert variant="error" className="mt-2 py-2 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
