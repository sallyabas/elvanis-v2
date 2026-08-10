"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { VARIANTS } from "./button-variants";

/**
 * Shared button component (confirmed 2026-08-07) — two variants,
 * matching the convention already established on the landing page (solid
 * amber for the direct/primary action, neutral outline for the secondary
 * one), now made a real reusable component instead of a hand-copied
 * className string per call site.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

// VARIANTS now lives in ./button-variants.ts, not here — see that file's
// docblock (confirmed 2026-08-10) for why: LinkButton.tsx needs the same
// values but is rendered from Server Components, which can't reliably
// resolve a named export from a "use client" module like this one.
export { VARIANTS };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    />
  );
});
