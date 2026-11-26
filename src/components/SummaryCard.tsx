"use client";

import type { SummaryResult } from "@/lib/llm";

/** Plain-language summary. Says when an AI model wrote it. */
export function SummaryCard({ data }: { data: SummaryResult }) {
  return (
    <div>
      <p className="text-lg leading-relaxed" data-testid="summary-text">{data.text}</p>
      {data.source === "llm" && (
        <p className="mt-2 text-xs text-muted">Written by an AI model from the computed facts only. Every year and number it uses is checked against those facts.</p>
      )}
    </div>
  );
}
