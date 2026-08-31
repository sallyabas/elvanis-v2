/**
 * "v2" briefing-document redesign (confirmed 2026-08-31) — the sidebar spec
 * explicitly requires "[User display name — if none set, show first part
 * of email before @; never show the full raw email address]". Investigated
 * first, not assumed: no code anywhere in this app derived a display name
 * before this — every nav/account surface rendered `user.email` (or
 * `profile?.email ?? user.email`) verbatim, confirmed via a full grep of
 * `src/app`. `users.name` exists on the schema (nullable, confirmed via the
 * original init migration) but nothing has ever collected it, so it is null
 * for every real account today — the email-local-part fallback is not a
 * rare edge case, it is the only case that will ever fire until a real
 * "set your name" UI exists (Account Settings already has a name field —
 * see that page's own form — so this isn't a missing capability, just
 * never yet used by any real test account).
 */
export function formatDisplayName(name: string | null | undefined, email: string | null | undefined): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;
  const local = email?.split("@")[0]?.trim();
  return local || "Account";
}
