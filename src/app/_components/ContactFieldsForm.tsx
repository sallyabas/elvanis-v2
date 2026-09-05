"use client";

import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";

/**
 * Shared contact-fields renderer (confirmed 2026-09-05, direct founder
 * request) — one real, reusable component for field rendering/validation,
 * used in two genuinely separate places with different destinations: the
 * session-request flow (SessionRequestButton.tsx, all six session types)
 * and the "Having trouble? Contact us" troubleshooting form
 * (ContactUsForm.tsx). Deliberately NOT merged into one form/mechanism —
 * each caller owns its own state and its own submit handler pointing at
 * its own destination (requestSession() vs. submitContactRequest()); this
 * component only renders the fields and reports whether they're valid.
 *
 * Phone is genuinely optional at the component level (undefined
 * phone/onPhoneChange simply omits that field) — the session-request flow
 * needs it, the Contact-us form doesn't (per its own explicit spec: Name
 * + Email required, no phone).
 */

export interface ContactFieldsValues {
  email: string;
  name: string;
  phone?: string;
  message: string;
}

/** Pure validation, exported so both callers gate their own submit button with the exact same rule rather than two independently-drifting checks. Phone is only required when the caller actually asked for it (passed a non-undefined value). */
export function isContactFieldsValid(values: ContactFieldsValues, requirePhone: boolean): boolean {
  const emailValid = /\S+@\S+\.\S+/.test(values.email.trim());
  const nameValid = values.name.trim().length > 0;
  const phoneValid = !requirePhone || (values.phone?.trim().length ?? 0) > 0;
  return emailValid && nameValid && phoneValid;
}

export function ContactFieldsForm({
  email,
  onEmailChange,
  name,
  onNameChange,
  phone,
  onPhoneChange,
  message,
  onMessageChange,
  messageLabel = "Message",
  messageHint,
  messageRequired = false,
  showValidation = false,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  name: string;
  onNameChange: (v: string) => void;
  phone?: string;
  onPhoneChange?: (v: string) => void;
  message: string;
  onMessageChange: (v: string) => void;
  messageLabel?: string;
  messageHint?: string;
  messageRequired?: boolean;
  /** Only show "required" error text once the caller has attempted a submit — a blank required field shouldn't read as an error before the visitor has even had a chance to fill it in. */
  showValidation?: boolean;
}) {
  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const nameValid = name.trim().length > 0;
  const phoneValid = phone === undefined || phone.trim().length > 0;

  return (
    <div className="space-y-3">
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        error={showValidation && !emailValid ? "A valid email is required" : undefined}
      />
      <Input
        label="Name"
        required
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        error={showValidation && !nameValid ? "Name is required" : undefined}
      />
      {phone !== undefined && onPhoneChange && (
        <Input
          label="Phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          error={showValidation && !phoneValid ? "Phone is required" : undefined}
        />
      )}
      <Textarea
        label={`${messageLabel}${messageRequired ? "" : " (optional)"}`}
        hint={messageHint}
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}
