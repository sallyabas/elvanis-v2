"use client";

import { useState } from "react";
import { submitDeliveryFeedback, type FeedbackType } from "@/lib/reviewer/delivery-feedback";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * Automated post-delivery feedback + pilot testimonial/referral prompt
 * (confirmed 2026-08-24, direct founder request) — genuinely new, no
 * existing pattern to reuse for the client-facing side (unlike the
 * notification/email plumbing, which does reuse the existing
 * infrastructure). Shown on the client Report page and the module detail
 * page once a delivery's already-submitted state (checked server-side,
 * passed in as `alreadySubmitted`) says there's nothing outstanding to
 * ask. Copy differs by feedbackType; the underlying mechanism (expand,
 * fill, submit) is shared.
 */
const COPY: Record<FeedbackType, { prompt: string; title: string; textLabel: string; textPlaceholder: string; submitLabel: string; thanks: string }> = {
  general: {
    prompt: "How was this?",
    title: "Quick feedback",
    textLabel: "Your feedback",
    textPlaceholder: "What worked, what didn't — anything at all.",
    submitLabel: "Send feedback",
    thanks: "Thanks — your feedback is genuinely read.",
  },
  testimonial: {
    prompt: "Share a testimonial or referral?",
    title: "Testimonial / referral",
    textLabel: "Testimonial (optional)",
    textPlaceholder: "A few words on what this was worth to you.",
    submitLabel: "Send",
    thanks: "Thank you — this genuinely helps.",
  },
};

export function DeliveryFeedbackPrompt({
  companyId,
  feedbackType,
  relatedReportId,
  relatedModuleRequestId,
  alreadySubmitted,
}: {
  companyId: string;
  feedbackType: FeedbackType;
  relatedReportId?: string | null;
  relatedModuleRequestId?: string | null;
  alreadySubmitted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [referralContact, setReferralContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(alreadySubmitted ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[feedbackType];

  async function handleSubmit() {
    setStatus("sending");
    setError(null);
    try {
      const result = await submitDeliveryFeedback({
        companyId,
        feedbackType,
        relatedReportId,
        relatedModuleRequestId,
        responseText,
        referralContact: feedbackType === "testimonial" ? referralContact : undefined,
      });
      if (result.success) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  if (status === "sent") {
    return <p className="text-xs text-neutral-400 dark:text-neutral-500">{copy.thanks}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {copy.prompt}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">{copy.title}</p>
      <div className="space-y-2">
        <Textarea label={copy.textLabel} rows={3} value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder={copy.textPlaceholder} />
        {feedbackType === "testimonial" && (
          <Input
            label="Referral (optional)"
            placeholder="A name or email of someone who might benefit"
            value={referralContact}
            onChange={(e) => setReferralContact(e.target.value)}
          />
        )}
        {status === "error" && error && (
          <Alert variant="error" className="py-2 text-xs">
            {error}
          </Alert>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setOpen(false)} disabled={status === "sending"}>
            Cancel
          </Button>
          <Button className="px-2 py-1 text-xs" onClick={handleSubmit} disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : copy.submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
