"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion, useInView } from "@/lib/client/useInView";

/** A number that counts up once when it scrolls into view. It always ends on the exact value; reduced motion skips the count. */
export function CountUp({ value, suffix = "", prefix = "", ms = 900 }: { value: number; suffix?: string; prefix?: string; ms?: number }) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, ms]);
  return (
    <span ref={ref}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
