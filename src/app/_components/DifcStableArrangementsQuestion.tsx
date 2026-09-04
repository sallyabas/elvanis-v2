"use client";

import { useId } from "react";
import { Select } from "@/app/_components/ui/Select";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";

/**
 * DIFC's own "stable arrangements" question (confirmed 2026-09-04, items
 * 6+7) — closes the one real limitation left by DIFC's own registration-
 * based `difcDpl` flag (see jurisdiction.ts's own docblock): DIFC's law
 * also reaches entities processing data WITHIN DIFC on an ongoing,
 * contractual basis, even without formal DIFC incorporation. Code can't
 * compute this from registration/customer-market data the way every other
 * jurisdiction flag is computed — asked directly instead, with an honest
 * "not sure" path.
 *
 * The ⓘ reveal reuses this codebase's existing <details> disclosure
 * pattern (export-instruction hints, FAQ items) rather than introducing a
 * genuinely new hover-tooltip interaction for one question.
 */
export function DifcStableArrangementsQuestion({
  companyId,
  value,
  onChange,
}: {
  companyId: string;
  value: "yes" | "no" | "not_sure" | null;
  onChange: (next: "yes" | "no" | "not_sure" | null) => void;
}) {
  const selectId = useId();

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Does your company have staff or systems physically located within DIFC, working on an ongoing or contractual
          basis (not a one-time engagement)?
        </label>
        <details className="group relative shrink-0">
          <summary className="cursor-pointer list-none text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300" aria-label="What counts as a stable arrangement?">
            ⓘ
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-neutral-200 bg-white p-3 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <p className="mb-1 font-medium text-green-700 dark:text-green-400">Yes, e.g.:</p>
            <ul className="mb-2 list-disc space-y-0.5 pl-4 text-neutral-600 dark:text-neutral-400">
              <li>An office or leased desk space inside DIFC</li>
              <li>Employees or contractors regularly working from DIFC</li>
              <li>Servers or systems hosted within DIFC on an ongoing basis</li>
            </ul>
            <p className="mb-1 font-medium text-red-700 dark:text-red-400">No, e.g.:</p>
            <ul className="list-disc space-y-0.5 pl-4 text-neutral-600 dark:text-neutral-400">
              <li>A one-off meeting or event held in DIFC</li>
              <li>A DIFC-registered company you have no other connection to</li>
              <li>Customers or partners based in DIFC, with no presence of your own there</li>
            </ul>
          </div>
        </details>
      </div>
      <Select
        id={selectId}
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as "yes" | "no" | "not_sure" | null)}
      >
        <option value="">Not yet answered</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
        <option value="not_sure">Not sure</option>
      </Select>
      {value === "not_sure" && (
        <div className="mt-2">
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
            That&apos;s fine — this is flagged for your reviewer to help you work out. In the meantime:
          </p>
          <SessionRequestButton companyId={companyId} sessionType="discovery" />
        </div>
      )}
    </div>
  );
}
