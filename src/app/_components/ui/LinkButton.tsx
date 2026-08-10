import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { VARIANTS } from "./button-variants";

/**
 * Real-navigation counterpart to Button.tsx (confirmed 2026-08-07) — for a
 * "next step" CTA that's a genuine link (e.g. Business Profile → Evidence
 * Intake), not a form-submit button. Shares Button's exact visual style via
 * the same VARIANTS map so the two can never drift apart.
 *
 * Imports from ./button-variants (a plain module, no "use client") rather
 * than from Button.tsx directly — confirmed 2026-08-10, a real bug found
 * live: LinkButton has no "use client" of its own and is rendered from
 * Server Components (NextStepBanner, the queue page, the report holding
 * page), and a Server Component importing a named export from a "use
 * client" file gets `undefined`, not the real value. See
 * button-variants.ts's own docblock for the full writeup.
 */
interface LinkButtonProps extends LinkProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function LinkButton({ variant = "primary", className, children, ...props }: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </Link>
  );
}
