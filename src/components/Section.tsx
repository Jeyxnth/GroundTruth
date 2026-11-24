"use client";

import type { ReactNode } from "react";
import { friendlyError, SECTION_ERROR_HEADING } from "@/lib/copy";
import type { Section as SectionData } from "@/lib/client/useSection";

/**
 * One result section, set as a ruled block rather than a box. It reserves its final height with `reserve`
 * (responsive min-height classes sized to the loaded content) so nothing jumps when it fills in, shows a skeleton while
 * pending, and shows its own error with Retry when it fails.
 */
export function SectionCard<T>({
  id,
  title,
  section,
  reserve,
  children,
  action,
  className = "",
  loadingContent,
  titleClass = "text-3xl sm:text-4xl",
}: {
  id: string;
  title: string;
  section: SectionData<T> | { status: "loading" | "idle" };
  /** Tailwind min-height classes matching the loaded height at each breakpoint. */
  reserve: string;
  children: (data: T) => ReactNode;
  action?: ReactNode;
  className?: string;
  /** Replaces the grey skeleton while loading (for example the wait panel). */
  loadingContent?: ReactNode;
  titleClass?: string;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      aria-busy={section.status === "loading"}
      className={`section border-t border-line pt-5 ${reserve} ${className}`}
      data-status={section.status}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={headingId} className={titleClass}>
          {title}
        </h2>
        {action}
      </div>
      {section.status === "loading" && (
        loadingContent ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading {title}…</span>
          {loadingContent}
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading {title}…</span>
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton mt-3 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-5/6" />
          <div className="skeleton mt-5 h-40 w-full" />
        </div>
      ))}
      {"error" in section && section.status === "error" && (
        <div role="alert" className="rounded-lg border border-line bg-panel p-4">
          <p className="font-medium">{SECTION_ERROR_HEADING}</p>
          <p className="mt-1 text-base text-muted">{friendlyError(section.error)}</p>
          {section.error.retryable && "retry" in section ? (
            <button type="button" onClick={section.retry} className="btn btn-primary no-print mt-3">
              Try again
            </button>
          ) : null}
        </div>
      )}
      {section.status === "ok" && "data" in section ? <div className="fade-in">{children(section.data)}</div> : null}
    </section>
  );
}
