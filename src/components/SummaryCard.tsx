"use client";

import type { SummaryResult } from "@/lib/llm";

/** Plain-language summary. Says plainly where it came from. */
export function SummaryCard({ data }: { data: SummaryResult }) {
  return (
    <div>
      <p className="text-base leading-relaxed" data-testid="summary-text">{data.text}</p>
      <p className="mt-2 text-xs text-muted">
        {data.source === "llm"
          ? "Written by an AI model from the computed facts only. Every year and number it uses is checked against those facts."
          : "Generated from a fixed template using only the computed facts"}
        {data.source === "template" && data.fallbackReason ? ` (AI summary not used: ${data.fallbackReason}).` : data.source === "template" ? "." : ""}
      </p>
    </div>
  );
}
