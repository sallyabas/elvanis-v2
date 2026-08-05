/**
 * Validation for the desired-future-state field (spec §1.9a, confirmed
 * 2026-08-02) — deliberately basic: length + a degenerate-input check,
 * never an AI judgment of whether the client's own words are "good
 * enough". Pure function, no "use server" — kept out of desired-future-state.ts
 * because Next.js requires every export of a "use server" file to be async.
 */

const MAX_LENGTH = 1000;
const MIN_LENGTH_FOR_SPAM_CHECK = 10;
const MAX_REPEATED_CHAR_RATIO = 0.6;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDesiredFutureState(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { valid: true }; // optional — blank is fine

  if (trimmed.length > MAX_LENGTH) {
    return { valid: false, error: `Keep it under ${MAX_LENGTH} characters.` };
  }

  if (trimmed.length >= MIN_LENGTH_FOR_SPAM_CHECK) {
    const counts = new Map<string, number>();
    for (const ch of trimmed) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    const mostCommonCount = Math.max(...counts.values());
    if (mostCommonCount / trimmed.length > MAX_REPEATED_CHAR_RATIO) {
      return { valid: false, error: "That doesn't look like a real answer — try describing it in your own words." };
    }
  }

  return { valid: true };
}
