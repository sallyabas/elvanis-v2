"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

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

// Exported so LinkButton.tsx (an <a>/next/link variant, for real navigation
// rather than a form action) can render the identical visual style without
// duplicating the className string.
export const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary:
    "border border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
};

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
