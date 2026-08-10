"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestReviewerMagicLink, verifyReviewerCode } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";
import { Card } from "@/app/_components/ui/Card";
import { Alert } from "@/app/_components/ui/Alert";

export default function ReviewerLoginPage() {
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

    const result = await requestReviewerMagicLink(email, window.location.origin);

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

    const result = await verifyReviewerCode(email, code);

    if (result.success) {
      // router.refresh() removed, confirmed 2026-08-07 — same fix as
      // OnboardingWizard.tsx and client-login/page.tsx: redundant and
      // racy immediately after push(). /queue is fully dynamic
      // (session-dependent), so push() alone already forces a fresh
      // server render.
      router.push("/queue");
    } else {
      setVerifying(false);
      setVerifyError(result.error ?? "That code didn't match — check it and try again.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-6 text-center">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 font-serif text-lg font-semibold text-accent dark:bg-neutral-800">
          E
        </span>
      </div>

      <Card className="p-6">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Reviewer sign-in</h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          Internal tool. Enter your reviewer email and we&apos;ll send you a sign-in link and a 6-digit code.
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
