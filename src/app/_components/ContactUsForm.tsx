"use client";

import { useState, useEffect } from "react";
import { submitContactRequest } from "@/lib/reviewer/contact-requests";
import { getContactFieldDefaults } from "@/lib/service-layer/session-requests";
import { ContactFieldsForm, isContactFieldsValid } from "@/app/_components/ContactFieldsForm";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * "Having trouble? Contact us" (confirmed 2026-09-05, direct founder
 * request) — one shared component, reused across every intake page (the
 * 3 module intakes + the general Services catalog page + Evidence
 * Intake), not duplicated per page. Genuinely separate from
 * SessionRequestButton.tsx (different destination — contact_requests,
 * not session_requests — and no phone field), even though both share the
 * same ContactFieldsForm.tsx field-rendering component. No Phone field
 * here, per the confirmed spec (Name + Email required, free-text
 * optional).
 *
 * `serviceContext` — a plain label naming which page this came from (e.g.
 * "Tender Readiness", "Evidence Intake"), stored on the request so a
 * reviewer sees at a glance where the client got stuck; nullable/"General"
 * for Evidence Intake specifically, per the confirmed decision, since
 * that page isn't itself one of the five paid services.
 */
export function ContactUsForm({ companyId, serviceContext }: { companyId: string | null; serviceContext: string | null }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getContactFieldDefaults().then((defaults) => {
      if (cancelled) return;
      setEmail((current) => current || defaults.email);
      setName((current) => current || defaults.name);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (!isContactFieldsValid({ email, name, message }, false)) return;

    setStatus("sending");
    setError(null);
    try {
      const result = await submitContactRequest(companyId, name.trim(), email.trim(), message, serviceContext);
      if (result.success) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      // Same uncaught-RPC-failure-class guard as every other client-facing
      // form action in this codebase (confirmed 2026-08-16 sweep, applied
      // consistently here from the start rather than found live later).
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  if (status === "sent") {
    return <Alert variant="success">Thanks — we&apos;ve got your message and will get back to you.</Alert>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400">
        Having trouble? Contact us
      </button>
    );
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Tell us what&apos;s going on and we&apos;ll follow up directly.</p>
      <div className="mb-3">
        <ContactFieldsForm
          email={email}
          onEmailChange={setEmail}
          name={name}
          onNameChange={setName}
          message={message}
          onMessageChange={setMessage}
          messageLabel="Describe your problem"
          showValidation={attemptedSubmit}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={status === "sending"}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {status === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          Cancel
        </button>
      </div>
      {status === "error" && error && (
        <Alert variant="error" className="mt-2 py-2 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
