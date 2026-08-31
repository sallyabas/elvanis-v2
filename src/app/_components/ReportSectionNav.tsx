"use client";

import { useEffect, useState } from "react";

/**
 * Sticky in-page section nav for the client Report page (confirmed
 * 2026-08-31, "v2" redesign bug-fix batch, item 3) — anchors to each of
 * the five lens sections actually rendered on the page (only lenses with
 * real findings get a section at all — see page.tsx's own
 * `LENS_ORDER.filter((lens) => byLens.has(lens))`, so `sections` here is
 * already pre-filtered to real, present sections by the caller, never a
 * fixed list of 5).
 *
 * Highlighting the active section as the user scrolls needs real client-
 * side scroll tracking — an IntersectionObserver watching each section's
 * own heading, the standard, cheap way to do scroll-spy without a manual
 * scroll-position calculation on every scroll event. The section whose
 * heading is nearest the top of the viewport (within a band near the top,
 * accounting for content that can be taller than the viewport) is treated
 * as "active."
 */
export function ReportSectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sections.length === 0) return null;

  return (
    <nav className="sticky top-10 hidden self-start lg:block">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">Sections</p>
      <ul className="space-y-0.5 border-l border-neutral-200">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`-ml-px block border-l-[3px] py-1 pl-3 text-sm transition-colors ${
                activeId === s.id ? "border-accent font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
