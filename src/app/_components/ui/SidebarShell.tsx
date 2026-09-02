"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Mobile-responsive sidebar shell (confirmed 2026-09-02, direct founder
 * fix following a real UX-pass finding) — both AppSidebar.tsx and
 * ReviewerSidebar.tsx were `fixed ... w-[200px]` with zero responsive
 * classes, and their parent layouts reserved that width unconditionally
 * (`ml-[200px]`, no breakpoint). Confirmed live at 375px: the sidebar took
 * ~52% of the viewport, permanently, on every authenticated page in the
 * app — client and reviewer both, since both use this exact same pattern.
 *
 * This is the one shared client wrapper both sidebars now render their
 * existing content through, rather than two separate copies of the same
 * drawer logic. AppSidebar/ReviewerSidebar themselves stay real Server
 * Components rendering from server-fetched props (displayName,
 * signalsCount) — only this shell needs client-side state, and Next.js
 * composition lets a Server Component pass JSX straight through a Client
 * Component's `children` without that content itself becoming client-only.
 *
 * Breakpoint is `lg` (1024px) — the same breakpoint this app's own
 * ReportSectionNav.tsx already uses for "sidebar-shaped content that
 * doesn't fit on a phone or a small tablet."
 *
 * Below `lg`: the sidebar becomes an off-canvas drawer (`-translate-x-full`
 * by default), opened via a slim fixed top bar (hamburger + wordmark) that
 * replaces the sidebar's own space, with a click-to-dismiss backdrop.
 * Auto-closes on navigation — necessary because this shell is mounted once
 * in the route-group layout and persists across client-side navigations
 * between pages in that group, so without this the drawer would still be
 * open, covering the next page's content. Closing on a pathname change is
 * done by adjusting state directly during render (comparing against a
 * `prevPathname` state, React's own documented pattern for "reset state
 * when a prop changes") rather than a `useEffect` — `eslint-plugin-
 * react-hooks`'s `set-state-in-effect` rule correctly flags the effect
 * version, since it causes an extra, avoidable render pass; the render-time
 * version resolves within the same render React was already doing.
 *
 * At `lg` and up: renders exactly as before (`lg:translate-x-0`, no top
 * bar, no backdrop) — zero visual change on desktop.
 */
export function SidebarShell({ children, mobileLabel }: { children: ReactNode; mobileLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-1.5 rounded-md p-1.5 text-neutral-700 hover:bg-neutral-100"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-neutral-900">{mobileLabel}</p>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[200px] flex-col border-r border-neutral-200 bg-white transition-transform duration-200 lg:z-30 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="absolute right-2 top-2 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </aside>
    </>
  );
}
