import Anthropic from "@anthropic-ai/sdk";
import type { Facts } from "@/lib/analysis/facts";
import { SUMMARY_SYSTEM_PROMPT, templateSummary, validateSummary } from "@/lib/analysis/summary";
import { getEnv } from "@/lib/env";

export type SummarySource = "llm" | "template";
export interface SummaryResult {
  text: string;
  source: SummarySource;
  /** Why the template was used instead of the LLM (null when the LLM text passed validation). */
  fallbackReason: string | null;
  model: string | null;
}

export const DEFAULT_SUMMARY_MODEL = "claude-opus-5-5";

/** Grounded summary: LLM text only if it validates against the facts, else the deterministic template. */
export async function summarize(
  facts: Facts,
  client?: Pick<Anthropic, "messages">,
): Promise<SummaryResult> {
  const env = getEnv();
  const template = (reason: string): SummaryResult => ({
    text: templateSummary(facts), source: "template", fallbackReason: reason, model: null,
  });

  if (!client && !env.ANTHROPIC_API_KEY) return template("ANTHROPIC_API_KEY is not set");
  const model = env.ANTHROPIC_MODEL ?? DEFAULT_SUMMARY_MODEL;

  try {
    const anthropic = client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 25_000, maxRetries: 1 });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Facts JSON:\n${JSON.stringify(facts)}` }],
    });
    if (response.stop_reason === "refusal") return template("model declined to answer");
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    const check = validateSummary(text, facts);
    if (!check.ok) return template(`LLM output failed validation: ${check.problems.slice(0, 3).join("; ")}`);
    return { text, source: "llm", fallbackReason: null, model };
  } catch (e) {
    const reason = e instanceof Anthropic.APIError ? `Anthropic API error ${e.status}` : "Anthropic request failed";
    console.error("[summary]", reason, e instanceof Error ? e.message : e);
    return template(reason);
  }
}
