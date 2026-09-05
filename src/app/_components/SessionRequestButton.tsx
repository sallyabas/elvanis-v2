"use client";

import { useEffect, useState } from "react";
import { requestSession, getContactFieldDefaults, type SessionType } from "@/lib/service-layer/session-requests";
import { ContactFieldsForm, isContactFieldsValid } from "@/app/_components/ContactFieldsForm";
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
  // Real, unified pricing (confirmed 2026-09-05, code-quality audit) —
  // this used to say "Contact Sales" with no price shown anywhere on this
  // surface, while the landing page's own Concierge card already showed a
  // real, DB-backed £300 (see the landing page's own "real, live pricing"
  // promise) — a genuine inconsistency: a prospect who saw £300 pre-signup
  // then reached this exact request flow post-signup and saw no price at
  // all. The `priceLabel` prop (below) carries the same DB-backed price
  // from `listPricing()`, threaded down from the one real call site
  // (services/page.tsx) — never a second hardcoded number that could
  // drift from the landing page's own.
  concierge_inquiry: {
    cta: "Request Concierge",
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
  // Reopened 2026-09-05, direct founder decision — "Training & Advisory"
  // was previously a "Coming soon" placeholder on Services with no working
  // request flow at all. "Contact Sales" framing only, matching how
  // Concierge's own button read before its pricing was unified — no price,
  // no payment link, a real scoping conversation with the reviewer first.
  training_advisory: {
    cta: "Contact Sales",
    sentLabel: "Training & Advisory inquiry sent",
    description: "Structured training and ongoing advisory for your team — scoped with you personally, not a checkout.",
  },
};

/**
 * Service Layer session requests, client-facing (confirmed 2026-08-06) —
 * no calendar/payment integration exists, so this is a real request +
 * human follow-up, not a fake booking flow. Shared across every client
 * surface that offers a session request.
 *
 * Mandatory contact fields (confirmed 2026-09-05, direct founder decision)
 * — Email/Name/Phone are now required on all six session types, using the
 * shared ContactFieldsForm.tsx (also used by the separate "Having
 * trouble? Contact us" form — two distinct forms, not merged). Pre-filled
 * from the client's own session email + Account Settings profile via
 * getContactFieldDefaults(), fetched once on mount rather than threaded
 * as props through this component's 5 heterogeneous call sites (two of
 * which are themselves client components) — still fully editable, still
 * required.
 */
export function SessionRequestButton({
  companyId,
  sessionType,
  prominent = false,
  priceLabel,
}: {
  companyId: string;
  sessionType: SessionType;
  /**
   * Full-width solid CTA with an arrow appended to its label (confirmed
   * 2026-09-03, direct founder feedback: "Request a Delivery Session"
   * on the client report page "buries it in descriptive body text").
   * Opt-in, defaulting to false — every OTHER real usage of this shared
   * component (Discovery on evidence-intake, Concierge on Services, the
   * report page's own Delivery/F2F pairing) keeps its existing compact
   * treatment; this only changes the one call site that asked for more
   * visual weight, not the component's default everywhere.
   */
  prominent?: boolean;
  /**
   * Real, formatted price (e.g. "£300") to show alongside the CTA
   * (confirmed 2026-09-05, Concierge pricing unification) — optional and
   * currently only ever passed for concierge_inquiry, the one session
   * type with a real, non-placeholder catalog price; the other four
   * types are genuinely free consultative calls with nothing to price.
   */
  priceLabel?: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getContactFieldDefaults().then((defaults) => {
      if (cancelled) return;
      setEmail(defaults.email);
      setName(defaults.name);
      setPhone(defaults.phone);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequest() {
    setAttemptedSubmit(true);
    if (!isContactFieldsValid({ email, name, phone, message: notes }, true)) return;

    setStatus("sending");
    setError(null);
    try {
      const result = await requestSession(companyId, sessionType, notes.trim() || null, email.trim(), name.trim(), phone.trim());
      if (result.success) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      // Real gap found and fixed while adding training_advisory (confirmed
      // 2026-09-05) — the same uncaught-RPC-failure class already fixed
      // repeatedly elsewhere in this codebase (all three module intake
      // forms, DocumentUploadField, the reviewer workspace action buttons,
      // FindingNotApplicableButton, SprintInterestButton) had never been
      // swept to this component: a genuine RPC-level rejection left
      // `status` stuck on "sending" forever, with no error and no way to
      // retry.
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
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
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        {LABELS[sessionType].description}
        {priceLabel && (
          <>
            {" "}
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">{priceLabel}.</span>
          </>
        )}
      </p>
      <div className="mb-3">
        <ContactFieldsForm
          email={email}
          onEmailChange={setEmail}
          name={name}
          onNameChange={setName}
          phone={phone}
          onPhoneChange={setPhone}
          message={notes}
          onMessageChange={setNotes}
          messageHint="Anything your reviewer should know before reaching out?"
          showValidation={attemptedSubmit}
        />
      </div>
      <button
        type="button"
        onClick={handleRequest}
        disabled={status === "sending"}
        className={
          prominent
            ? "w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
            : "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        }
      >
        {status === "sending"
          ? "Requesting…"
          : `${LABELS[sessionType].cta}${priceLabel ? ` — ${priceLabel}` : ""}${prominent ? " →" : ""}`}
      </button>
      {status === "error" && error && (
        <Alert variant="error" className="mt-2 py-2 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
