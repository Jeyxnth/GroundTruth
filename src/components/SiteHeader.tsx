"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Fixed header. Over a hero it starts transparent and turns solid once the page scrolls; an optional chip (the verdict)
 * appears after the hero leaves the screen, and a thin line shows how far through the page you are.
 */
export function SiteHeader({ overHero = false, chip, showChip = false, progress = false, children }: { overHero?: boolean; chip?: ReactNode; showChip?: boolean; progress?: boolean; children?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        if (progress) {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          document.documentElement.style.setProperty("--scroll", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [progress]);
  const solid = !overHero || scrolled;
  return (
    <header className="site-header no-print" data-solid={solid} data-over={overHero ? "hero" : "page"} style={!solid ? { color: "#f2f6f8" } : undefined}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-3 px-4 sm:px-8">
        <Link href="/" translate="no" className="tap -ml-2 px-2 font-display text-xl font-semibold tracking-tight">
          GroundTruth
        </Link>
        {chip && (
          <div className="header-chip flex min-w-0 items-center gap-2 text-base font-medium" data-show={showChip && solid} aria-hidden={!showChip}>
            {chip}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {children}
          <ThemeToggle />
        </div>
      </div>
      {progress && <div className="scroll-progress" aria-hidden="true" />}
    </header>
  );
}
