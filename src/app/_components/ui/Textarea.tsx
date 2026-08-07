"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

/** Shared design-system primitive — see Input.tsx for the full rationale. */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, rows = 3, ...props },
  ref,
) {
  const textareaId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
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
