"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";

/**
 * Shared design-system primitive (confirmed 2026-08-07) — replaces the
 * per-page `className="w-full rounded border px-3 py-2 text-sm"` pattern
 * repeated with no color specified on the border (rendering as the
 * browser default, part of the "looks old" gap flagged directly: brand
 * colors had only ever been applied to nav/buttons, never the form UI
 * itself). Built as a real component, not just a shared class name, so
 * label/hint/error placement stays consistent everywhere it's used, not
 * re-decided per call site.
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...props },
  ref,
) {
  // Real bug found live via the Playwright E2E suite (confirmed
  // 2026-09-02) — id ?? props.name silently produced NO id/htmlFor pairing
  // at all whenever a call site passed neither (e.g. OnboardingWizard.tsx's
  // "Company name" field), since React omits an attribute entirely when
  // its value is undefined. The label still rendered correctly (a sighted
  // user could read it fine), but with zero programmatic association —
  // getByLabel() genuinely could not find the field, and neither could a
  // screen reader or a real "click the label to focus the field" click.
  // useId() as the final fallback guarantees a real, stable, unique id
  // exists on every instance regardless of what the caller passes, fixing
  // this at the root rather than patching individual call sites (Textarea/
  // Select share this exact same pattern, fixed identically).
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full rounded-md border px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition-colors placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            : "border-neutral-300 bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-neutral-700 dark:bg-neutral-900"
        } ${className ?? ""}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});
