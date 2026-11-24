"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useInView } from "@/lib/client/useInView";

/**
 * Fades a block in as it scrolls into view. Server HTML and no-script pages show everything: the hidden state only
 * exists after the client has taken over, and print always shows it.
 */
export function Reveal({
  children,
  delay = 0,
  kind = "rise",
  className = "",
}: {
  children: ReactNode;
  /** Stagger step: each step is 80 ms. */
  delay?: number;
  kind?: "rise" | "scale";
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "0px 0px -6% 0px" });
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} data-kind={kind} data-state={!armed || inView ? "shown" : "pending"} style={{ "--d": delay } as CSSProperties}>
      {children}
    </div>
  );
}
