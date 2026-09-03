"use client";

import { useState } from "react";
import { confirmUnsubscribe } from "./actions";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * The confirm-then-act half of the bot-prescanning-safe design (see
 * actions.ts's docblock for the full reasoning) — the token verifies and
 * the label/email render on the server (page.tsx), but the actual
 * preference write only happens from this real button's onClick, same
 * "call the server action directly from a client handler" pattern
 * already used by SessionRequestButton.tsx elsewhere in this app.
 */
export function UnsubscribeConfirm({ token, label, email }: { token: string; label: string; email: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("pending");
    setError(null);
    const result = await confirmUnsubscribe(token);
    if (result.success) {
      setStatus("done");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  if (status === "done") {
    return <Alert variant="success">Done — {email} won&apos;t receive {label} anymore. You can turn this back on anytime from Account Settings.</Alert>;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-700 dark:text-neutral-300">
        Unsubscribe <span className="font-medium">{email}</span> from <span className="font-medium">{label}</span>?
      </p>
      <Button onClick={handleConfirm} disabled={status === "pending"}>
        {status === "pending" ? "Unsubscribing…" : "Confirm unsubscribe"}
      </Button>
      {status === "error" && error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}
    </div>
  );
}
