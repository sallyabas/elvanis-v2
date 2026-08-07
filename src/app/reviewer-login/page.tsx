"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestReviewerMagicLink, verifyReviewerCode } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";

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
      setErrorMessage(result.error ?? "Something went wrong.");
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
      setVerifyError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-semibold">Reviewer sign-in</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Internal tool. Enter your reviewer email and we&apos;ll send you a sign-in link and code.
      </p>

      {status === "sent" ? (
        <div className="space-y-4">
          <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            Check your email — click the link, or enter the code below (use the code if the link says
            expired/invalid, which some email providers cause by prescanning links).
          </p>
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <Input
              type="text"
              inputMode="numeric"
              required
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={verifyError ?? undefined}
            />
            <Button type="submit" disabled={verifying} className="w-full">
              {verifying ? "Verifying…" : "Verify code"}
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={status === "error" ? (errorMessage ?? undefined) : undefined}
          />
          <Button type="submit" disabled={status === "sending"} className="w-full">
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </Button>
        </form>
      )}
    </div>
  );
}
