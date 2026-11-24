import Link from "next/link";

/** Wordmark. A plain link home; sits above every screen and is hidden in print by the page header. */
export function SiteHeader() {
  return (
    <header className="no-print border-b border-line">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" translate="no" className="tap -ml-2 px-2 font-display text-xl font-semibold tracking-tight">
          GroundTruth
        </Link>
      </div>
    </header>
  );
}
