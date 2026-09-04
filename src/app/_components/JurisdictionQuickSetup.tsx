"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JurisdictionFieldsEditor, type JurisdictionFieldsValue } from "@/app/_components/JurisdictionFieldsEditor";
import { updateJurisdictionQuickSetup } from "@/lib/modules/shared/jurisdiction-quick-setup";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * Inline jurisdiction-fields prompt, shown on Tender Readiness's and Data
 * Protection Compliance's own intake pages when registration/customer-
 * market data is genuinely empty (confirmed 2026-09-04, item 5) — the
 * page's existing footnote already linked out to Business Profile; this
 * lets a client fix it right here instead, without losing their place.
 * On save, calls router.refresh() so the SERVER page recomputes real
 * applicability from the freshly-written data — no client-side
 * duplication of computeJurisdictionApplicability().
 */
export function JurisdictionQuickSetup({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [value, setValue] = useState<JurisdictionFieldsValue>({ registrationCountry: null, uaeFreeZone: null, customerMarketCountries: [] });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    const result = await updateJurisdictionQuickSetup(companyId, value);
    if (result.success) {
      setStatus("saved");
      router.refresh();
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="mb-6 rounded-md border border-accent/30 bg-accent/5 p-4">
      <p className="mb-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">
        Why we&apos;re asking: these two fields are what determine which regulations actually apply to you — without them, this
        request won&apos;t surface any jurisdiction-specific findings. You can fill them in right here, or on Business Profile later.
      </p>
      <div className="space-y-4">
        <JurisdictionFieldsEditor value={value} onChange={setValue} />
      </div>
      {status === "error" && error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}
      {status === "saved" && (
        <Alert variant="success" className="mt-3">
          Saved — the regulations below now reflect this.
        </Alert>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save"}
        </Button>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">Still unsure which jurisdiction applies to you?</p>
        <SessionRequestButton companyId={companyId} sessionType="discovery" />
      </div>
    </div>
  );
}
