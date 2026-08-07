import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { VARIANTS } from "./Button";

/**
 * Real-navigation counterpart to Button.tsx (confirmed 2026-08-07) — for a
 * "next step" CTA that's a genuine link (e.g. Business Profile → Evidence
 * Intake), not a form-submit button. Shares Button's exact visual style via
 * the exported VARIANTS map so the two can never drift apart.
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
