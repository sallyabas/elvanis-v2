"use client";

import { useState } from "react";
import { runDigitalPresenceCheckAction } from "./actions";
import type { DigitalPresenceResult } from "@/lib/digital-presence/check";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

type TechnicalSeoBooleanKey = keyof Omit<NonNullable<DigitalPresenceResult["technicalSeo"]>, "titleText">;

const SEO_CHECK_LABELS: { key: TechnicalSeoBooleanKey; label: string }[] = [
  { key: "https", label: "Uses HTTPS" },
  { key: "hasTitle", label: "Has a page title" },
  { key: "hasMetaDescription", label: "Has a meta description" },
  { key: "hasViewportMeta", label: "Mobile-friendly viewport tag" },
  { key: "hasCanonical", label: "Has a canonical link" },
  { key: "hasH1", label: "Has a main heading (H1)" },
  { key: "robotsTxtReachable", label: "robots.txt reachable" },
  { key: "sitemapXmlReachable", label: "sitemap.xml reachable" },
];

/**
 * Digital Presence check, client-facing (confirmed 2026-08-14, item 7 of
 * the old-Elvanis-inspired batch) — real-time, on-demand, never persisted.
 * See src/lib/digital-presence/check.ts for the full design reasoning,
 * including the deliberate scope narrowing vs. the still-deferred bigger
 * "Digital Presence Scan" feature.
 */
export function DigitalPresenceCheck({ companyId, hasWebsiteUrl }: { companyId: string; hasWebsiteUrl: boolean }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<DigitalPresenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setStatus("running");
    setError(null);
    const res = await runDigitalPresenceCheckAction(companyId);
    if (res.success && res.result) {
      setResult(res.result);
      setStatus("done");
    } else {
      setError(res.error ?? "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
        A quick, real-time check of your website&apos;s basic technical health and which social/review channels it links to. Uses a plain page fetch, not a
        browser — a site built entirely with client-side JavaScript may show false negatives here even if it looks fine to a visitor.
      </p>
      {!hasWebsiteUrl && <Alert variant="info">Add a website URL above and save, then come back to run this check.</Alert>}
      {hasWebsiteUrl && (
        <Button type="button" variant="secondary" onClick={handleRun} disabled={status === "running"}>
          {status === "running" ? "Checking…" : "Run digital presence check"}
        </Button>
      )}

      {status === "error" && error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      {status === "done" && result && !result.fetchedSuccessfully && (
        <Alert variant="error" className="mt-3">
          {result.error ?? "Could not check this site."}
        </Alert>
      )}

      {status === "done" && result?.fetchedSuccessfully && result.technicalSeo && (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <h3 className="mb-2 font-medium text-neutral-900 dark:text-neutral-50">Technical health</h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {SEO_CHECK_LABELS.map(({ key, label }) => {
                const value = result.technicalSeo![key] as boolean;
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span className={value ? "text-green-600 dark:text-green-400" : "text-neutral-400 dark:text-neutral-500"}>{value ? "✓" : "✕"}</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
                  </li>
                );
              })}
            </ul>
            {result.technicalSeo.titleText && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Page title found: &quot;{result.technicalSeo.titleText}&quot;</p>}
          </div>

          <div>
            <h3 className="mb-2 font-medium text-neutral-900 dark:text-neutral-50">Social &amp; review channels linked from your homepage</h3>
            {result.socialChannels.length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-400">No known social or review channel links found on the homepage.</p>
            ) : (
              <ul className="space-y-1">
                {result.socialChannels.map((c) => (
                  <li key={c.platform} className="flex items-center gap-2">
                    <span className={c.reachable ? "text-green-600 dark:text-green-400" : "text-neutral-400 dark:text-neutral-500"}>{c.reachable ? "✓" : "✕"}</span>
                    <span className="text-neutral-700 dark:text-neutral-300">
                      {c.platform} {c.reachable ? "— reachable" : "— linked, but not reachable right now"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
