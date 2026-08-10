"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestClientMagicLink, verifyClientCode } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";
import { Card } from "@/app/_components/ui/Card";
import { Alert } from "@/app/_components/ui/Alert";

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const result = await requestClientMagicLink(email, window.location.origin);

    if (result.sent) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMessage(result.error ?? "Something went wrong. Please try again in a moment.");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);

    const result = await verifyClientCode(email, code);

    if (result.success) {
      // router.refresh() removed, confirmed 2026-08-07 — the same
      // real bug found and fixed in OnboardingWizard.tsx: calling it
      // immediately after push() races with the push's own navigation and
      // can leave the UI stuck mid-transition. Redundant here regardless —
      // /business-profile is fully dynamic (session-dependent), so push()
      // alone already forces a fresh server render; there's no stale
      // cached version of a page never visited yet this session for
      // refresh() to bust.
      router.push("/business-profile");
    } else {
      setVerifying(false);
      setVerifyError(result.error ?? "That code didn't match — check it and try again.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      {/* Wordmark + Card treatment (confirmed 2026-08-10, real bug list from
          live testing — "OTP/send-code screen text and button feel cheap
          and untrustworthy") — this was previously a bare page background
          with no visual identity at all, the exact gap the earlier visual
          design audit flagged for this screen specifically. Now matches
          the rest of the app's real card/border treatment instead of
          floating text on an empty page. */}
      <div className="mb-6 text-center">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 font-serif text-lg font-semibold text-accent dark:bg-neutral-800">
          E
        </span>
      </div>

      <Card className="p-6">
        {/* Copy confirmed 2026-08-07 — the landing page's nav CTA now reads
            "Get started" with no further explanation, and its old "No
            password — we'll email you a code" note was removed as visual
            clutter. This page is now the one place that explanation lives,
            led with the founder's own exact wording: a first-time visitor
            needs to know clicking through creates their account
            automatically, not just that there's no password.
            Copy tightened again 2026-08-10 — same message, shorter
            sentences, less "technical debug message" phrasing (e.g. was
            "6-digit backup code" framed as a fallback mechanism; now framed
            as a normal part of signing in). */}
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Get started</h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          Enter your email and we&apos;ll get you straight in — new here or returning, it works the same way. No
          password to remember: we&apos;ll email you a sign-in link and a 6-digit code.
        </p>

        {status === "sent" ? (
          <div className="space-y-4">
            <Alert variant="success">
              We&apos;ve sent an email to <span className="font-medium">{email}</span>. Click the link, or enter the
              6-digit code below — use the code if the link ever says expired or invalid (some email apps open links
              automatically before you click them).
            </Alert>
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <Input
                label="6-digit code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={verifyError ?? undefined}
              />
              <Button type="submit" disabled={verifying || code.length === 0} className="w-full">
                {verifying ? "Verifying…" : "Verify code"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setCode("");
                  setVerifyError(null);
                }}
                className="w-full text-center text-xs text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                Use a different email
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Email"
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={status === "error" ? (errorMessage ?? undefined) : undefined}
            />
            <Button type="submit" disabled={status === "sending" || email.length === 0} className="w-full">
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
