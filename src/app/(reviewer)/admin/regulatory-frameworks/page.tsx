import { listRegulatoryFrameworks } from "@/lib/reviewer/regulatory-frameworks";
import { FrameworkRow } from "./FrameworkRow";

/**
 * Regulatory Framework Tracker — the real standalone admin page (confirmed
 * 2026-09-05), replacing the previous /queue-embedded "Regulatory content
 * status" panel entirely (not left running alongside it — see this
 * session's own "full migration, not two parallel trackers" decision).
 * Reviewer-only, same auth gate as every other page under (reviewer)/.
 *
 * "Nothing here auto-detects regulatory changes" — the brief's own
 * framing, kept verbatim as the subheader, since it's the one honest
 * sentence this whole tracker exists to keep true: this is a discipline
 * tool, not a monitoring system.
 */
export default async function RegulatoryFrameworksPage() {
  const frameworks = await listRegulatoryFrameworks();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Regulatory Framework Tracker</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Manual review tracker — nothing here auto-detects regulatory changes. This is a discipline tool, not a monitoring system.
      </p>

      <ul className="space-y-3">
        {frameworks.map((f) => (
          <FrameworkRow key={f.id} framework={f} />
        ))}
      </ul>
    </div>
  );
}
