"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { VARIANTS, SIZES } from "./button-variants";

/**
 * Shared button component (confirmed 2026-08-07) — two variants,
 * matching the convention already established on the landing page (solid
 * amber for the direct/primary action, neutral outline for the secondary
 * one), now made a real reusable component instead of a hand-copied
 * className string per call site.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  /** Real size variant (confirmed 2026-09-05) — see button-variants.ts's own docblock. Defaults to "md", the original fixed size, so every existing call site is unaffected. */
  size?: "md" | "sm";
}

// VARIANTS now lives in ./button-variants.ts, not here — see that file's
// docblock (confirmed 2026-08-10) for why: LinkButton.tsx needs the same
// values but is rendered from Server Components, which can't reliably
// resolve a named export from a "use client" module like this one.
export { VARIANTS };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // Real, confirmed design fix (2026-09-03, direct founder feedback):
      // disabled:opacity-40 on top of the primary variant's bg-accent
      // just faded the copper to a beige-ish wash, reading as "still
      // copper, just weaker" rather than a genuinely inactive state —
      // the exact complaint, applying everywhere a disabled primary
      // button appears (Continue buttons across every onboarding step,
      // not a one-off). Replaced with an explicit disabled palette
      // (#d1d5db background, matching neutral-500 text) that overrides
      // both variants' own colors outright — a real grey, not a faded
      // copper — while keeping disabled:cursor-not-allowed and dropping
      // the shadow (a disabled button shouldn't read as elevated/
      // actionable).
      className={`inline-flex items-center justify-center rounded-md font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#d1d5db] disabled:text-neutral-500 disabled:shadow-none ${SIZES[size]} ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    />
  );
});
