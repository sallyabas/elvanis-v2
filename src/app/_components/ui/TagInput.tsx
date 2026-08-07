"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Real tag-input UI (confirmed 2026-08-07) — replaces the "type a
 * comma-separated string into a plain text input" pattern used for
 * multi-value fields (social links, tools/stack), which relied on the
 * client already knowing to type commas rather than the UI showing them
 * how. Enter or comma commits the current draft as a tag; Backspace on an
 * empty draft removes the last tag; blur also commits any in-progress
 * draft so a value isn't silently lost on click-away.
 */
interface TagInputProps {
  label?: string;
  hint?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ label, hint, value, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</label>}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-1.5 shadow-sm transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 dark:border-neutral-700 dark:bg-neutral-900">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={value.length === 0 ? placeholder : "Add another…"}
          className="min-w-[8rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
      </div>
      {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}
