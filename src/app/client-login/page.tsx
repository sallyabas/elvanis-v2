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
      router.push("/business-profile");
      router.refresh();
    } else {
      setVerifying(false);
      setVerifyError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Enter your email and we&apos;ll send you a sign-in link and code — no password needed. New here? The same
        link creates your account.
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
              className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
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
            className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}
