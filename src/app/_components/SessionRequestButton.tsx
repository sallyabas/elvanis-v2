"use client";

import { useState } from "react";
import { requestSession, type SessionType } from "@/lib/service-layer/session-requests";

const LABELS: Record<SessionType, { cta: string; sentLabel: string }> = {
  discovery: { cta: "Request a Discovery Session", sentLabel: "Discovery Session requested" },
  delivery: { cta: "Request a Delivery Session", sentLabel: "Delivery Session requested" },
  f2f_workshop: { cta: "Request an F2F Workshop", sentLabel: "F2F Workshop requested" },
};

/**
 * Service Layer session requests, client-facing (confirmed 2026-08-06) —
 * no calendar/payment integration exists, so this is a real request +
 * human follow-up, not a fake booking flow. Shared across the two client
 * surfaces that offer a session request (evidence-intake for Discovery,
 * the delivered-report page for Delivery/F2F Workshop) — kept here rather
 * than duplicated per route, unlike this codebase's usual "one small
 * component per route group" convention, since the three variants are
 * genuinely identical apart from copy.
 */
export function SessionRequestButton({ companyId, sessionType }: { companyId: string; sessionType: SessionType }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setStatus("sending");
    setError(null);
    const result = await requestSession(companyId, sessionType, null);
    if (result.success) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-green-700 dark:text-green-400">{LABELS[sessionType].sentLabel} — we&apos;ll follow up to schedule it.</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRequest}
        disabled={status === "sending"}
        className="rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
      >
        {status === "sending" ? "Requesting…" : LABELS[sessionType].cta}
      </button>
      {status === "error" && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
