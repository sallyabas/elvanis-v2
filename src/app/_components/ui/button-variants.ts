/**
 * Real bug found and fixed (confirmed 2026-08-10, discovered during live
 * verification of the real bug list, not one of the 7 reported items
 * itself) — `VARIANTS` previously lived in Button.tsx, which has "use
 * client" at the top. `LinkButton.tsx` (and its consumers — NextStepBanner,
 * the reviewer queue page, the client report holding page — none of which
 * declare "use client") are Server Components, and a Server Component
 * importing a named, non-component export from a "use client" module gets
 * `undefined` at render time, not the real value — Next.js's client-
 * boundary transform only preserves the actual component reference, not
 * arbitrary constants, across that boundary. This silently rendered every
 * server-rendered LinkButton with a literal "undefined" class fragment
 * instead of its real amber/outline styling — confirmed live via computed
 * styles (`getComputedStyle(...).backgroundColor` was fully transparent)
 * on the "Add or revise evidence" CTA, reproduced after a full hard
 * navigation, not an HMR artifact.
 *
 * Fixed by extracting the variant class strings into their own plain
 * module with no "use client" directive — both Button.tsx (client) and
 * LinkButton.tsx (server-renderable) import the same real values from
 * here, so neither environment depends on resolving a named export across
 * a client-component boundary.
 */
/**
 * "v2" briefing-document redesign (confirmed 2026-08-31, spec point 6):
 * "copper only, no purple, no blue anywhere" — primary buttons get white
 * text on the copper fill (a real, deliberate change from the prior pass's
 * dark accent-ink text), secondary/outline buttons get a copper border +
 * copper text on white, replacing the previous neutral-outline treatment.
 */
export const VARIANTS: Record<"primary" | "secondary", string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-accent bg-white text-accent hover:bg-[#fdf6ee]",
};
