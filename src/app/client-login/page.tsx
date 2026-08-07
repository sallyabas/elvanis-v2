"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestClientMagicLink, verifyClientCode } from "./actions";

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
      setErrorMessage(result.error ?? "Something went wrong.");
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
      setVerifyError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      {/* Copy confirmed 2026-08-07 — the landing page's nav CTA now reads
          "Get started" with no further explanation, and its old "No
          password — we'll email you a code" note was removed as visual
          clutter. This page is now the one place that explanation lives,
          led with the founder's own exact wording: a first-time visitor
          needs to know clicking through creates their account
          automatically, not just that there's no password. */}
      <h1 className="mb-1 text-xl font-semibold">Get started</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Enter your email to get started — we&apos;ll create your account or log you in automatically. No password
        needed: we&apos;ll send you a sign-in link and a 6-digit backup code.
      </p>

      {status === "sent" ? (
        <div className="space-y-4">
          <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            Check your email — click the link, or enter the code below (use the code if the link says
            expired/invalid, which some email providers cause by prescanning links).
          </p>
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}
            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-40"
            >
              {verifying ? "Verifying…" : "Verify code"}
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          {status === "error" && errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-40"
          >
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}
