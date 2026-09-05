"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Select } from "@/app/_components/ui/Select";
import { Input } from "@/app/_components/ui/Input";

/**
 * Search/filter for the company directory (confirmed 2026-09-05,
 * code-quality audit item 6) — real usage patterns from this session's own
 * testing shaped which three filters were worth building: plan tier
 * (distinguishing a real Concierge relationship from the free default),
 * activity recency (surfacing stalled/abandoned signups versus genuinely
 * active accounts — exactly the kind of thing this session's own repeated
 * "stale test account" cleanup work made obvious was worth filtering on),
 * and entry_path (the two real product paths — Business Diagnosis vs. AI
 * Audit — plus the real "undecided" state a company can be stuck in).
 * Client-side filtering over an already-fetched row set, same convention
 * already established on /requests (RequestsFilterClient.tsx) — real
 * company volume (31 rows at the time this was built) is small enough
 * that fetching once and filtering in-memory is simpler and faster than a
 * server round-trip per filter change.
 */

export interface CompanyDirectoryRow {
  id: string;
  name: string;
  planTier: string;
  entryPath: string | null;
  lastActivity: string | null;
}

const ENTRY_PATH_LABELS: Record<string, string> = {
  diagnosis: "Business Diagnosis",
  ai_audit: "AI Audit",
  undecided: "Undecided",
};

type RecencyBucket = "all" | "7d" | "30d" | "90d" | "stale";

function withinRecency(lastActivity: string | null, bucket: RecencyBucket): boolean {
  if (bucket === "all") return true;
  if (!lastActivity) return bucket === "stale";
  const ageMs = Date.now() - new Date(lastActivity).getTime();
  const days = ageMs / (24 * 60 * 60 * 1000);
  if (bucket === "7d") return days <= 7;
  if (bucket === "30d") return days <= 30;
  if (bucket === "90d") return days <= 90;
  return days > 90; // stale
}

export function CompaniesFilterClient({ rows }: { rows: CompanyDirectoryRow[] }) {
  const [nameSearch, setNameSearch] = useState("");
  const [planTierFilter, setPlanTierFilter] = useState("all");
  const [entryPathFilter, setEntryPathFilter] = useState("all");
  const [recencyFilter, setRecencyFilter] = useState<RecencyBucket>("all");

  const planTierOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.planTier))).sort(), [rows]);
  const entryPathOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entryPath).filter((v): v is string => v !== null))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (nameSearch.trim() && !r.name.toLowerCase().includes(nameSearch.trim().toLowerCase())) return false;
      if (planTierFilter !== "all" && r.planTier !== planTierFilter) return false;
      if (entryPathFilter !== "all" && (r.entryPath ?? "undecided") !== entryPathFilter) return false;
      if (!withinRecency(r.lastActivity, recencyFilter)) return false;
      return true;
    });
  }, [rows, nameSearch, planTierFilter, entryPathFilter, recencyFilter]);

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Input label="Company name" placeholder="Search…" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} />

        <Select label="Plan tier" value={planTierFilter} onChange={(e) => setPlanTierFilter(e.target.value)}>
          <option value="all">All plan tiers</option>
          {planTierOptions.map((t) => (
            <option key={t} value={t} className="capitalize">
              {t}
            </option>
          ))}
        </Select>

        <Select label="Entry path" value={entryPathFilter} onChange={(e) => setEntryPathFilter(e.target.value)}>
          <option value="all">All entry paths</option>
          {entryPathOptions.map((p) => (
            <option key={p} value={p}>
              {ENTRY_PATH_LABELS[p] ?? p}
            </option>
          ))}
        </Select>

        <Select label="Activity" value={recencyFilter} onChange={(e) => setRecencyFilter(e.target.value as RecencyBucket)}>
          <option value="all">Any time</option>
          <option value="7d">Active in last 7 days</option>
          <option value="30d">Active in last 30 days</option>
          <option value="90d">Active in last 90 days</option>
          <option value="stale">No activity in 90+ days (or none)</option>
        </Select>
      </div>

      <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
        {filtered.length} of {rows.length} companies
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No companies match these filters.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white px-4 shadow-card-1 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/company/${r.id}`} className="font-medium text-accent underline hover:text-accent-hover">
                  {r.name}
                </Link>
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {r.planTier}
                </span>
                {r.entryPath && (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {ENTRY_PATH_LABELS[r.entryPath] ?? r.entryPath}
                  </span>
                )}
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {r.lastActivity ? `Last activity ${new Date(r.lastActivity).toLocaleDateString()}` : "No activity yet"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
