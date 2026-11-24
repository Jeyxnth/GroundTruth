"use client";

import { useEffect, useRef, useState } from "react";

/** Width of an element in CSS pixels, kept current. SVG charts draw at this width so text is true size on every screen. */
export function useWidth<T extends HTMLElement>(initial = 360) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}
