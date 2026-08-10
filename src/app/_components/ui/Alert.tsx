import type { ReactNode } from "react";

/**
 * Shared notification/message component (confirmed 2026-08-10, real bug
 * list from live testing) — closes a real, app-wide gap: most error/
 * success/info messages across this codebase were bare
 * `<p className="text-sm text-red-600">{message}</p>` strings with no
 * background, border, or icon, so they read as raw/unstyled text rather
 * than a designed product surface (the exact complaint: "error messages
 * look like raw browser validation"). A few places (client-login's sent
 * confirmation, ModuleReviewWorkspaceClient's blocked-approve banner) had
 * already hand-rolled a boxed treatment ad hoc — this generalizes that
 * pattern into one real component so every message in the app gets the
 * same icon + colored background + border + rounded-corner treatment,
 * not just the ones someone happened to style by hand.
 */
type AlertVariant = "error" | "success" | "warning" | "info";

const VARIANT_STYLES: Record<AlertVariant, string> = {
  error: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  success: "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  warning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  info: "border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
};

const VARIANT_ICONS: Record<AlertVariant, string> = {
  error: "✕",
  success: "✓",
  warning: "!",
  info: "i",
};

const ICON_STYLES: Record<AlertVariant, string> = {
  error: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300",
  success: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300",
  warning: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  info: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function Alert({
  variant = "error",
  children,
  className,
}: {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-md border p-3 text-sm ${VARIANT_STYLES[variant]} ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ICON_STYLES[variant]}`}
      >
        {VARIANT_ICONS[variant]}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
