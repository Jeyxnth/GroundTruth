"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("gt-theme", cb);
  return () => window.removeEventListener("gt-theme", cb);
};
const read = (): "light" | "dark" => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
const readServer = (): "light" | "dark" => "dark";

/** Dark is the default. The choice is remembered in this browser only (and the page still works if storage is blocked). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, readServer);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="tap rounded-lg"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("gt-theme", next);
        } catch {
          /* storage blocked: the choice lasts for this visit */
        }
        window.dispatchEvent(new Event("gt-theme"));
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}
