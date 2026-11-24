"use client";

import type { ReactNode } from "react";
import type { Section as SectionData } from "@/lib/client/useSection";

/**
 * One result section. Reserves its height while loading (no layout shift when it fills in),
 * shows a skeleton while pending, and a clear per-section error with Retry.
 */
export function SectionCard<T>({
  id,
  title,
  section,
  minHeight,
  children,
  action,
}: {
  id: string;
  title: string;
  section: SectionData<T> | { status: "loading" | "idle" };
  minHeight: number;
  children: (data: T) => ReactNode;
  action?: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      aria-busy={section.status === "loading"}
      className="section rounded-lg border border-line bg-background p-4 sm:p-5"
      style={{ minHeight }}
      data-status={section.status}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {section.status === "loading" && (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading {title}…</span>
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton mt-3 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-5/6" />
          <div className="skeleton mt-4" style={{ height: Math.max(60, minHeight - 140) }} />
        </div>
      )}
      {"error" in section && section.status === "error" && (
        <div role="alert" className="rounded-md border border-line bg-panel p-3">
          <p className="font-medium">This section could not be loaded.</p>
          <p className="mt-1 text-sm text-muted">{section.error.message}</p>
          {section.error.retryable && "retry" in section ? (
            <button
              type="button"
              onClick={section.retry}
              className="no-print mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-[var(--accent-ink)]"
            >
              Retry
            </button>
          ) : null}
        </div>
      )}
      {section.status === "ok" && "data" in section ? children(section.data) : null}
    </section>
  );
}
